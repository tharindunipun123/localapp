import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, getAppSettings, createNotification, FieldValue } from "./helpers";

const REGION = "us-central1";
const DIDIT_API = "https://verification.didit.me/v3";

type DiditIdVerification = {
  status?: string;
  document_type?: string | null;
  document_number?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  expiration_date?: string | null;
  issuing_state?: string | null;
  portrait_image?: string | null;
  warnings?: { risk?: string; log_type?: string; short_description?: string }[];
};

type DiditFaceMatch = {
  status?: string;
  score?: number;
  warnings?: { risk?: string }[];
};

type DiditLiveness = {
  status?: string;
  score?: number;
};

type MultipartField = {
  name: string;
  filename?: string;
  type?: string;
  value: Buffer | string;
};

function buildMultipart(fields: MultipartField[]) {
  const boundary = `----LocalApp${Date.now()}${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const field of fields) {
    if (field.filename && Buffer.isBuffer(field.value)) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\nContent-Type: ${field.type || "application/octet-stream"}\r\n\r\n`
        ),
        field.value,
        Buffer.from("\r\n")
      );
    } else {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${String(field.value)}\r\n`
        )
      );
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function applyKycOutcome(
  userId: string,
  kycStatus: "approved" | "rejected" | "pending",
  extra: Record<string, unknown> = {}
) {
  const settings = await getAppSettings();
  await db.doc(`kycSubmissions/${userId}`).set(
    {
      userId,
      ...extra,
      status: kycStatus,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.doc(`users/${userId}`).update({
    kycStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (kycStatus === "approved") {
    await db.doc(`wallets/${userId}`).set(
      {
        spendingLimitDaily: settings.defaultSpendingLimitDaily,
        spendingLimitMonthly: settings.defaultSpendingLimitMonthly,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await createNotification(
      userId,
      "KYC Approved",
      "Your identity verification is complete.",
      "kyc_approved"
    );
  } else if (kycStatus === "rejected") {
    await createNotification(
      userId,
      "KYC Rejected",
      "Your identity verification did not pass. Please try again with a clearer ID and selfie.",
      "kyc_rejected"
    );
  }
}

export function mapDiditSessionStatus(diditStatus: string): "approved" | "rejected" | "pending" {
  const statusMap: Record<string, "approved" | "rejected" | "pending"> = {
    Approved: "approved",
    Declined: "rejected",
    "In Review": "pending",
    "Not Started": "pending",
    "In Progress": "pending",
    "Not Finished": "pending",
    Resubmitted: "pending",
    Abandoned: "rejected",
    Expired: "rejected",
  };
  return statusMap[diditStatus] ?? "pending";
}

async function createWorkflow(apiKey: string): Promise<string> {
  const wfRes = await fetch(`${DIDIT_API}/workflows/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      workflow_label: "Local App KYC",
      features: [
        { feature: "OCR" },
        { feature: "LIVENESS", config: { face_liveness_method: "PASSIVE" } },
        { feature: "FACE_MATCH" },
      ],
    }),
  });

  if (!wfRes.ok) {
    const errBody = await wfRes.text();
    throw new HttpsError(
      "internal",
      `Could not create Didit workflow. Add a workflow ID in Admin → Settings. ${errBody.slice(0, 240)}`
    );
  }

  const wf = (await wfRes.json()) as { id?: string; workflow_id?: string };
  const workflowId = wf.id ?? wf.workflow_id ?? "";
  if (!workflowId) throw new HttpsError("internal", "Didit workflow response missing id");
  await db.doc("settings/app").set({ diditWorkflowId: workflowId }, { merge: true });
  return workflowId;
}

async function postDiditSession(apiKey: string, workflowId: string, uid: string, siteUrl: string) {
  return fetch(`${DIDIT_API}/session/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: uid,
      callback: `${siteUrl}/kyc/complete`,
    }),
  });
}

export async function createDiditHostedSession(uid: string) {
  const settings = await getAppSettings();
  const apiKey = settings.diditApiKey;
  if (!apiKey) {
    throw new HttpsError("internal", "KYC provider not configured. Add a Didit API key in Admin → Settings.");
  }

  let workflowId = settings.diditWorkflowId || (await createWorkflow(apiKey));
  let sessionRes = await postDiditSession(apiKey, workflowId, uid, settings.siteUrl);

  if (!sessionRes.ok) {
    workflowId = await createWorkflow(apiKey);
    sessionRes = await postDiditSession(apiKey, workflowId, uid, settings.siteUrl);
  }

  if (!sessionRes.ok) {
    const errBody = await sessionRes.text();
    throw new HttpsError("internal", `Didit session error: ${errBody.slice(0, 400)}`);
  }

  const session = (await sessionRes.json()) as {
    session_id: string;
    url: string;
    status: string;
  };

  await db.doc(`kycSubmissions/${uid}`).set(
    {
      userId: uid,
      sessionId: session.session_id,
      provider: "didit",
      mode: "hosted",
      status: "pending",
      diditStatus: session.status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await db.doc(`users/${uid}`).update({
    kycStatus: "pending",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { url: session.url, sessionId: session.session_id };
}

async function downloadStorageFile(path: string): Promise<{ buffer: Buffer; contentType: string; name: string }> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  const [buf] = await file.download();
  const [meta] = await file.getMetadata().catch(() => [undefined]);
  const contentType =
    (meta && typeof meta === "object" && "contentType" in meta && typeof meta.contentType === "string"
      ? meta.contentType
      : "image/jpeg");
  const name = path.split("/").pop() || "image.jpg";
  return { buffer: buf, contentType, name };
}

async function fetchImageBuffer(urlOrBase64: string): Promise<Buffer | null> {
  if (!urlOrBase64) return null;
  if (urlOrBase64.startsWith("http")) {
    const res = await fetch(urlOrBase64);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  const cleaned = urlOrBase64.replace(/^data:image\/\w+;base64,/, "");
  try {
    return Buffer.from(cleaned, "base64");
  } catch {
    return null;
  }
}

function decideFromStandalone(idStatus?: string, faceStatus?: string, livenessStatus?: string) {
  if (idStatus === "Declined" || faceStatus === "Declined" || livenessStatus === "Declined") {
    return "rejected" as const;
  }
  if (idStatus === "Approved" && faceStatus === "Approved") {
    return "approved" as const;
  }
  return "pending" as const;
}

/** In-app ID front/back + selfie → Didit standalone ID + face match (+ liveness). */
export const submitKycDocuments = onCall(
  { region: REGION, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { frontPath, backPath, selfiePath, identity } = (request.data ?? {}) as {
      frontPath?: string;
      backPath?: string;
      selfiePath?: string;
      identity?: {
        nicNumber?: string;
        fullLegalName?: string;
        dateOfBirth?: string;
        phone?: string;
        bankName?: string;
        bankAccount?: string;
        address?: string;
      };
    };

    if (!frontPath || !selfiePath) {
      throw new HttpsError("invalid-argument", "ID front and selfie are required");
    }
    if (!frontPath.startsWith(`kyc/${uid}/`) || !selfiePath.startsWith(`kyc/${uid}/`)) {
      throw new HttpsError("permission-denied", "Invalid image path");
    }
    if (backPath && !backPath.startsWith(`kyc/${uid}/`)) {
      throw new HttpsError("permission-denied", "Invalid image path");
    }

    const userSnap = await db.doc(`users/${uid}`).get();
    if (userSnap.data()?.kycStatus === "approved") {
      throw new HttpsError("failed-precondition", "KYC already approved");
    }

    const nic = (identity?.nicNumber ?? "").replace(/\s+/g, "").toUpperCase();
    if (nic && !/^(\d{9}[VX]|\d{12})$/.test(nic)) {
      throw new HttpsError("invalid-argument", "NIC must be 9 digits + V/X or 12 digits");
    }
    if (identity?.dateOfBirth) {
      const dob = new Date(identity.dateOfBirth);
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(dob.getTime()) || age < 18) {
        throw new HttpsError("invalid-argument", "You must be 18 or older");
      }
    }
    if (identity?.bankAccount && !/^\d{10,16}$/.test(identity.bankAccount)) {
      throw new HttpsError("invalid-argument", "Bank account must be 10–16 digits");
    }

    if (identity?.phone || identity?.fullLegalName || nic) {
      await db.doc(`users/${uid}`).set(
        {
          ...(identity?.phone ? { phone: identity.phone } : {}),
          ...(identity?.fullLegalName ? { legalName: identity.fullLegalName } : {}),
          ...(nic ? { nicNumber: nic } : {}),
          ...(identity?.dateOfBirth ? { dateOfBirth: identity.dateOfBirth } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await db.doc(`kycSubmissions/${uid}`).set(
      {
        userId: uid,
        identity: identity ?? {},
        fullName: identity?.fullLegalName ?? "",
        frontPath,
        selfiePath,
        backPath: backPath ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const settings = await getAppSettings();
    const apiKey = settings.diditApiKey;
    if (!apiKey) {
      throw new HttpsError("internal", "KYC provider not configured. Add a Didit API key in Admin → Settings.");
    }

    const front = await downloadStorageFile(frontPath);
    const selfie = await downloadStorageFile(selfiePath);
    const back = backPath ? await downloadStorageFile(backPath).catch(() => null) : null;

    const idParts = buildMultipart([
      { name: "front_image", filename: front.name, type: front.contentType, value: front.buffer },
      ...(back
        ? [{ name: "back_image", filename: back.name, type: back.contentType, value: back.buffer }]
        : []),
      { name: "perform_document_liveness", value: "true" },
      { name: "save_api_request", value: "true" },
      { name: "vendor_data", value: uid },
      { name: "expiration_date_not_detected_action", value: "NO_ACTION" },
    ]);

    const idRes = await fetch(`${DIDIT_API}/id-verification/`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": idParts.contentType },
      body: idParts.body,
    });

    if (idRes.status === 403) {
      const hosted = await createDiditHostedSession(uid);
      return {
        status: "pending",
        fallbackUrl: hosted.url,
        sessionId: hosted.sessionId,
        message: "Continue with the free camera verification — photograph your ID and take a selfie there.",
      };
    }

    if (!idRes.ok) {
      const errBody = await idRes.text();
      if (idRes.status === 400 && errBody.includes("COULD_NOT_RECOGNIZE_DOCUMENT")) {
        throw new HttpsError(
          "invalid-argument",
          "Could not read the ID card. Photograph the full card, all four corners visible, no glare."
        );
      }
      throw new HttpsError("internal", `ID verification failed: ${errBody.slice(0, 280)}`);
    }

    const idJson = (await idRes.json()) as {
      request_id?: string;
      id_verification?: DiditIdVerification;
    };
    const idv = idJson.id_verification ?? {};

    let face: DiditFaceMatch = {};
    const portraitBuf = (await fetchImageBuffer(idv.portrait_image ?? "")) ?? front.buffer;

    const faceParts = buildMultipart([
      { name: "user_image", filename: selfie.name, type: selfie.contentType, value: selfie.buffer },
      { name: "ref_image", filename: "portrait.jpg", type: "image/jpeg", value: portraitBuf },
      { name: "vendor_data", value: uid },
    ]);

    const faceRes = await fetch(`${DIDIT_API}/face-match/`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": faceParts.contentType },
      body: faceParts.body,
    });

    if (faceRes.ok) {
      const faceJson = (await faceRes.json()) as DiditFaceMatch & { face_match?: DiditFaceMatch };
      face = faceJson.face_match ?? faceJson;
    } else if (faceRes.status === 403) {
      const hosted = await createDiditHostedSession(uid);
      return {
        status: "pending",
        fallbackUrl: hosted.url,
        sessionId: hosted.sessionId,
        message: "Continue with the free camera verification to finish face match.",
      };
    } else {
      const errBody = await faceRes.text();
      throw new HttpsError("internal", `Face match failed: ${errBody.slice(0, 280)}`);
    }

    let liveness: DiditLiveness = {};
    const liveParts = buildMultipart([
      { name: "user_image", filename: selfie.name, type: selfie.contentType, value: selfie.buffer },
      { name: "vendor_data", value: uid },
    ]);
    const liveRes = await fetch(`${DIDIT_API}/passive-liveness/`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": liveParts.contentType },
      body: liveParts.body,
    });
    if (liveRes.ok) {
      const liveJson = (await liveRes.json()) as DiditLiveness & { liveness?: DiditLiveness };
      liveness = liveJson.liveness ?? liveJson;
    }

    const kycStatus = decideFromStandalone(idv.status, face.status, liveness.status);
    const extracted = {
      fullName: idv.full_name ?? [idv.first_name, idv.last_name].filter(Boolean).join(" "),
      documentType: idv.document_type ?? "",
      documentNumber: idv.document_number ?? "",
      dateOfBirth: idv.date_of_birth ?? "",
      nationality: idv.nationality ?? "",
      expirationDate: idv.expiration_date ?? "",
      issuingState: idv.issuing_state ?? "",
    };

    await applyKycOutcome(uid, kycStatus, {
      provider: "didit",
      mode: "in_app",
      sessionId: idJson.request_id ?? "",
      diditStatus: kycStatus === "approved" ? "Approved" : kycStatus === "rejected" ? "Declined" : "In Review",
      frontPath,
      backPath: backPath ?? "",
      selfiePath,
      extracted,
      fullName: identity?.fullLegalName || extracted.fullName,
      identity: identity ?? {},
      idVerification: {
        status: idv.status ?? "",
        warnings: (idv.warnings ?? []).map((w) => w.risk ?? w.short_description).filter(Boolean),
      },
      faceMatch: {
        status: face.status ?? "",
        score: face.score ?? null,
      },
      liveness: {
        status: liveness.status ?? "",
        score: liveness.score ?? null,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      status: kycStatus,
      extracted,
      faceScore: face.score ?? null,
      idStatus: idv.status ?? "",
      faceStatus: face.status ?? "",
    };
  }
);

/** Poll Didit session decision when the webhook is delayed. */
export const refreshKycDecision = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const snap = await db.doc(`kycSubmissions/${uid}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "No KYC submission");

  const sub = snap.data()!;
  const sessionId = sub.sessionId as string | undefined;
  if (!sessionId) return { status: sub.status ?? "pending" };

  const settings = await getAppSettings();
  if (!settings.diditApiKey) return { status: sub.status ?? "pending" };

  const res = await fetch(`${DIDIT_API}/session/${sessionId}/decision/`, {
    headers: { "x-api-key": settings.diditApiKey },
  });
  if (!res.ok) return { status: sub.status ?? "pending" };

  const decision = (await res.json()) as {
    status?: string;
    id_verifications?: DiditIdVerification[];
    face_matches?: DiditFaceMatch[];
    liveness_checks?: DiditLiveness[];
  };

  const diditStatus = decision.status ?? "";
  const kycStatus = mapDiditSessionStatus(diditStatus);
  const idv = decision.id_verifications?.[0];
  const face = decision.face_matches?.[0];
  const extracted = idv
    ? {
        fullName: idv.full_name ?? "",
        documentType: idv.document_type ?? "",
        documentNumber: idv.document_number ?? "",
        dateOfBirth: idv.date_of_birth ?? "",
        nationality: idv.nationality ?? "",
      }
    : (sub.extracted as Record<string, unknown>) ?? {};

  await applyKycOutcome(uid, kycStatus, {
    diditStatus,
    decision,
    extracted,
    fullName: (extracted as { fullName?: string }).fullName ?? sub.fullName ?? "",
    faceMatch: face ? { status: face.status ?? "", score: face.score ?? null } : sub.faceMatch ?? {},
  });

  return { status: kycStatus, diditStatus };
});
