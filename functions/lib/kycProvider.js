"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshKycDecision = exports.submitKycDocuments = void 0;
exports.applyKycOutcome = applyKycOutcome;
exports.mapDiditSessionStatus = mapDiditSessionStatus;
exports.createDiditHostedSession = createDiditHostedSession;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
const DIDIT_API = "https://verification.didit.me/v3";
function buildMultipart(fields) {
    const boundary = `----LocalApp${Date.now()}${Math.random().toString(16).slice(2)}`;
    const chunks = [];
    for (const field of fields) {
        if (field.filename && Buffer.isBuffer(field.value)) {
            chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\nContent-Type: ${field.type || "application/octet-stream"}\r\n\r\n`), field.value, Buffer.from("\r\n"));
        }
        else {
            chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${String(field.value)}\r\n`));
        }
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return {
        body: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}
async function applyKycOutcome(userId, kycStatus, extra = {}) {
    const settings = await (0, helpers_1.getAppSettings)();
    await helpers_1.db.doc(`kycSubmissions/${userId}`).set({
        userId,
        ...extra,
        status: kycStatus,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    await helpers_1.db.doc(`users/${userId}`).update({
        kycStatus,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    if (kycStatus === "approved") {
        await helpers_1.db.doc(`wallets/${userId}`).set({
            spendingLimitDaily: settings.defaultSpendingLimitDaily,
            spendingLimitMonthly: settings.defaultSpendingLimitMonthly,
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        await (0, helpers_1.createNotification)(userId, "KYC Approved", "Your identity verification is complete.", "kyc_approved");
    }
    else if (kycStatus === "rejected") {
        await (0, helpers_1.createNotification)(userId, "KYC Rejected", "Your identity verification did not pass. Please try again with a clearer ID and selfie.", "kyc_rejected");
    }
}
function mapDiditSessionStatus(diditStatus) {
    var _a;
    const statusMap = {
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
    return (_a = statusMap[diditStatus]) !== null && _a !== void 0 ? _a : "pending";
}
async function createWorkflow(apiKey) {
    var _a, _b;
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
        throw new https_1.HttpsError("internal", `Could not create Didit workflow. Add a workflow ID in Admin → Settings. ${errBody.slice(0, 240)}`);
    }
    const wf = (await wfRes.json());
    const workflowId = (_b = (_a = wf.id) !== null && _a !== void 0 ? _a : wf.workflow_id) !== null && _b !== void 0 ? _b : "";
    if (!workflowId)
        throw new https_1.HttpsError("internal", "Didit workflow response missing id");
    await helpers_1.db.doc("settings/app").set({ diditWorkflowId: workflowId }, { merge: true });
    return workflowId;
}
async function postDiditSession(apiKey, workflowId, uid, siteUrl) {
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
async function createDiditHostedSession(uid) {
    const settings = await (0, helpers_1.getAppSettings)();
    const apiKey = settings.diditApiKey;
    if (!apiKey) {
        throw new https_1.HttpsError("internal", "KYC provider not configured. Add a Didit API key in Admin → Settings.");
    }
    let workflowId = settings.diditWorkflowId || (await createWorkflow(apiKey));
    let sessionRes = await postDiditSession(apiKey, workflowId, uid, settings.siteUrl);
    if (!sessionRes.ok) {
        workflowId = await createWorkflow(apiKey);
        sessionRes = await postDiditSession(apiKey, workflowId, uid, settings.siteUrl);
    }
    if (!sessionRes.ok) {
        const errBody = await sessionRes.text();
        throw new https_1.HttpsError("internal", `Didit session error: ${errBody.slice(0, 400)}`);
    }
    const session = (await sessionRes.json());
    await helpers_1.db.doc(`kycSubmissions/${uid}`).set({
        userId: uid,
        sessionId: session.session_id,
        provider: "didit",
        mode: "hosted",
        status: "pending",
        diditStatus: session.status,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    await helpers_1.db.doc(`users/${uid}`).update({
        kycStatus: "pending",
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { url: session.url, sessionId: session.session_id };
}
async function downloadStorageFile(path) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const [buf] = await file.download();
    const [meta] = await file.getMetadata().catch(() => [undefined]);
    const contentType = (meta && typeof meta === "object" && "contentType" in meta && typeof meta.contentType === "string"
        ? meta.contentType
        : "image/jpeg");
    const name = path.split("/").pop() || "image.jpg";
    return { buffer: buf, contentType, name };
}
async function fetchImageBuffer(urlOrBase64) {
    if (!urlOrBase64)
        return null;
    if (urlOrBase64.startsWith("http")) {
        const res = await fetch(urlOrBase64);
        if (!res.ok)
            return null;
        return Buffer.from(await res.arrayBuffer());
    }
    const cleaned = urlOrBase64.replace(/^data:image\/\w+;base64,/, "");
    try {
        return Buffer.from(cleaned, "base64");
    }
    catch (_a) {
        return null;
    }
}
function decideFromStandalone(idStatus, faceStatus, livenessStatus) {
    if (idStatus === "Declined" || faceStatus === "Declined" || livenessStatus === "Declined") {
        return "rejected";
    }
    if (idStatus === "Approved" && faceStatus === "Approved") {
        return "approved";
    }
    return "pending";
}
/** In-app ID front/back + selfie → Didit standalone ID + face match (+ liveness). */
exports.submitKycDocuments = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { frontPath, backPath, selfiePath, identity } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!frontPath || !selfiePath) {
        throw new https_1.HttpsError("invalid-argument", "ID front and selfie are required");
    }
    if (!frontPath.startsWith(`kyc/${uid}/`) || !selfiePath.startsWith(`kyc/${uid}/`)) {
        throw new https_1.HttpsError("permission-denied", "Invalid image path");
    }
    if (backPath && !backPath.startsWith(`kyc/${uid}/`)) {
        throw new https_1.HttpsError("permission-denied", "Invalid image path");
    }
    const userSnap = await helpers_1.db.doc(`users/${uid}`).get();
    if (((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.kycStatus) === "approved") {
        throw new https_1.HttpsError("failed-precondition", "KYC already approved");
    }
    const nic = ((_c = identity === null || identity === void 0 ? void 0 : identity.nicNumber) !== null && _c !== void 0 ? _c : "").replace(/\s+/g, "").toUpperCase();
    if (nic && !/^(\d{9}[VX]|\d{12})$/.test(nic)) {
        throw new https_1.HttpsError("invalid-argument", "NIC must be 9 digits + V/X or 12 digits");
    }
    if (identity === null || identity === void 0 ? void 0 : identity.dateOfBirth) {
        const dob = new Date(identity.dateOfBirth);
        const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(dob.getTime()) || age < 18) {
            throw new https_1.HttpsError("invalid-argument", "You must be 18 or older");
        }
    }
    if ((identity === null || identity === void 0 ? void 0 : identity.bankAccount) && !/^\d{10,16}$/.test(identity.bankAccount)) {
        throw new https_1.HttpsError("invalid-argument", "Bank account must be 10–16 digits");
    }
    if ((identity === null || identity === void 0 ? void 0 : identity.phone) || (identity === null || identity === void 0 ? void 0 : identity.fullLegalName) || nic) {
        await helpers_1.db.doc(`users/${uid}`).set({
            ...((identity === null || identity === void 0 ? void 0 : identity.phone) ? { phone: identity.phone } : {}),
            ...((identity === null || identity === void 0 ? void 0 : identity.fullLegalName) ? { legalName: identity.fullLegalName } : {}),
            ...(nic ? { nicNumber: nic } : {}),
            ...((identity === null || identity === void 0 ? void 0 : identity.dateOfBirth) ? { dateOfBirth: identity.dateOfBirth } : {}),
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await helpers_1.db.doc(`kycSubmissions/${uid}`).set({
        userId: uid,
        identity: identity !== null && identity !== void 0 ? identity : {},
        fullName: (_d = identity === null || identity === void 0 ? void 0 : identity.fullLegalName) !== null && _d !== void 0 ? _d : "",
        frontPath,
        selfiePath,
        backPath: backPath !== null && backPath !== void 0 ? backPath : "",
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    const settings = await (0, helpers_1.getAppSettings)();
    const apiKey = settings.diditApiKey;
    if (!apiKey) {
        throw new https_1.HttpsError("internal", "KYC provider not configured. Add a Didit API key in Admin → Settings.");
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
            throw new https_1.HttpsError("invalid-argument", "Could not read the ID card. Photograph the full card, all four corners visible, no glare.");
        }
        throw new https_1.HttpsError("internal", `ID verification failed: ${errBody.slice(0, 280)}`);
    }
    const idJson = (await idRes.json());
    const idv = (_e = idJson.id_verification) !== null && _e !== void 0 ? _e : {};
    let face = {};
    const portraitBuf = (_g = (await fetchImageBuffer((_f = idv.portrait_image) !== null && _f !== void 0 ? _f : ""))) !== null && _g !== void 0 ? _g : front.buffer;
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
        const faceJson = (await faceRes.json());
        face = (_h = faceJson.face_match) !== null && _h !== void 0 ? _h : faceJson;
    }
    else if (faceRes.status === 403) {
        const hosted = await createDiditHostedSession(uid);
        return {
            status: "pending",
            fallbackUrl: hosted.url,
            sessionId: hosted.sessionId,
            message: "Continue with the free camera verification to finish face match.",
        };
    }
    else {
        const errBody = await faceRes.text();
        throw new https_1.HttpsError("internal", `Face match failed: ${errBody.slice(0, 280)}`);
    }
    let liveness = {};
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
        const liveJson = (await liveRes.json());
        liveness = (_j = liveJson.liveness) !== null && _j !== void 0 ? _j : liveJson;
    }
    const kycStatus = decideFromStandalone(idv.status, face.status, liveness.status);
    const extracted = {
        fullName: (_k = idv.full_name) !== null && _k !== void 0 ? _k : [idv.first_name, idv.last_name].filter(Boolean).join(" "),
        documentType: (_l = idv.document_type) !== null && _l !== void 0 ? _l : "",
        documentNumber: (_m = idv.document_number) !== null && _m !== void 0 ? _m : "",
        dateOfBirth: (_o = idv.date_of_birth) !== null && _o !== void 0 ? _o : "",
        nationality: (_p = idv.nationality) !== null && _p !== void 0 ? _p : "",
        expirationDate: (_q = idv.expiration_date) !== null && _q !== void 0 ? _q : "",
        issuingState: (_r = idv.issuing_state) !== null && _r !== void 0 ? _r : "",
    };
    await applyKycOutcome(uid, kycStatus, {
        provider: "didit",
        mode: "in_app",
        sessionId: (_s = idJson.request_id) !== null && _s !== void 0 ? _s : "",
        diditStatus: kycStatus === "approved" ? "Approved" : kycStatus === "rejected" ? "Declined" : "In Review",
        frontPath,
        backPath: backPath !== null && backPath !== void 0 ? backPath : "",
        selfiePath,
        extracted,
        fullName: (identity === null || identity === void 0 ? void 0 : identity.fullLegalName) || extracted.fullName,
        identity: identity !== null && identity !== void 0 ? identity : {},
        idVerification: {
            status: (_t = idv.status) !== null && _t !== void 0 ? _t : "",
            warnings: ((_u = idv.warnings) !== null && _u !== void 0 ? _u : []).map((w) => { var _a; return (_a = w.risk) !== null && _a !== void 0 ? _a : w.short_description; }).filter(Boolean),
        },
        faceMatch: {
            status: (_v = face.status) !== null && _v !== void 0 ? _v : "",
            score: (_w = face.score) !== null && _w !== void 0 ? _w : null,
        },
        liveness: {
            status: (_x = liveness.status) !== null && _x !== void 0 ? _x : "",
            score: (_y = liveness.score) !== null && _y !== void 0 ? _y : null,
        },
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return {
        status: kycStatus,
        extracted,
        faceScore: (_z = face.score) !== null && _z !== void 0 ? _z : null,
        idStatus: (_0 = idv.status) !== null && _0 !== void 0 ? _0 : "",
        faceStatus: (_1 = face.status) !== null && _1 !== void 0 ? _1 : "",
    };
});
/** Poll Didit session decision when the webhook is delayed. */
exports.refreshKycDecision = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const snap = await helpers_1.db.doc(`kycSubmissions/${uid}`).get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "No KYC submission");
    const sub = snap.data();
    const sessionId = sub.sessionId;
    if (!sessionId)
        return { status: (_a = sub.status) !== null && _a !== void 0 ? _a : "pending" };
    const settings = await (0, helpers_1.getAppSettings)();
    if (!settings.diditApiKey)
        return { status: (_b = sub.status) !== null && _b !== void 0 ? _b : "pending" };
    const res = await fetch(`${DIDIT_API}/session/${sessionId}/decision/`, {
        headers: { "x-api-key": settings.diditApiKey },
    });
    if (!res.ok)
        return { status: (_c = sub.status) !== null && _c !== void 0 ? _c : "pending" };
    const decision = (await res.json());
    const diditStatus = (_d = decision.status) !== null && _d !== void 0 ? _d : "";
    const kycStatus = mapDiditSessionStatus(diditStatus);
    const idv = (_e = decision.id_verifications) === null || _e === void 0 ? void 0 : _e[0];
    const face = (_f = decision.face_matches) === null || _f === void 0 ? void 0 : _f[0];
    const extracted = idv
        ? {
            fullName: (_g = idv.full_name) !== null && _g !== void 0 ? _g : "",
            documentType: (_h = idv.document_type) !== null && _h !== void 0 ? _h : "",
            documentNumber: (_j = idv.document_number) !== null && _j !== void 0 ? _j : "",
            dateOfBirth: (_k = idv.date_of_birth) !== null && _k !== void 0 ? _k : "",
            nationality: (_l = idv.nationality) !== null && _l !== void 0 ? _l : "",
        }
        : (_m = sub.extracted) !== null && _m !== void 0 ? _m : {};
    await applyKycOutcome(uid, kycStatus, {
        diditStatus,
        decision,
        extracted,
        fullName: (_p = (_o = extracted.fullName) !== null && _o !== void 0 ? _o : sub.fullName) !== null && _p !== void 0 ? _p : "",
        faceMatch: face ? { status: (_q = face.status) !== null && _q !== void 0 ? _q : "", score: (_r = face.score) !== null && _r !== void 0 ? _r : null } : (_s = sub.faceMatch) !== null && _s !== void 0 ? _s : {},
    });
    return { status: kycStatus, diditStatus };
});
//# sourceMappingURL=kycProvider.js.map