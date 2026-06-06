import { getAppSettings } from "./helpers";

export type NotifyLkConfig = {
  userId: string;
  apiKey: string;
  senderId: string;
};

export async function getNotifyLkConfig(): Promise<NotifyLkConfig> {
  const settings = await getAppSettings();
  return {
    userId: settings.notifyLkUserId ?? process.env.NOTIFYLK_USER_ID ?? "",
    apiKey: settings.notifyLkApiKey ?? process.env.NOTIFYLK_API_KEY ?? "",
    senderId: settings.notifyLkSenderId ?? process.env.NOTIFYLK_SENDER_ID ?? "NotifyDEMO",
  };
}

/** E.164 (+94771234567) or local (0712345678) → Notify.lk format 94771234567 */
export function toNotifyLkPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94")) return digits;
  if (digits.startsWith("0")) return `94${digits.slice(1)}`;
  if (digits.length === 9) return `94${digits}`;
  throw new Error("Invalid Sri Lankan phone number");
}

/** Store/display as +94771234567 */
export function toE164Phone(phone: string): string {
  const notify = toNotifyLkPhone(phone);
  return `+${notify}`;
}

export async function sendNotifyLkSms(to: string, message: string): Promise<void> {
  const config = await getNotifyLkConfig();
  if (!config.userId || !config.apiKey) {
    throw new Error("NOTIFYLK_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({
    user_id: config.userId,
    api_key: config.apiKey,
    sender_id: config.senderId,
    to,
    message,
  });

  const res = await fetch("https://app.notify.lk/api/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  if (!res.ok || data.status === "error") {
    throw new Error(data.message ?? `Notify.lk HTTP ${res.status}`);
  }
}
