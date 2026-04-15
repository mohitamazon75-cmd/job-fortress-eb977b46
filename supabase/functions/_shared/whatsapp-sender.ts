// ═══════════════════════════════════════════════════════════════
// whatsapp-sender.ts — Meta WhatsApp Business API utility
//
// Sends template-based WhatsApp notifications to Indian users.
// India open rate: 85-95% vs email 15-25%.
//
// ZERO-REGRESSION DESIGN:
//   - All sends are fire-and-forget alongside (never instead of) email
//   - Returns false silently when WHATSAPP_PHONE_NUMBER_ID or
//     WHATSAPP_ACCESS_TOKEN env vars are missing
//   - Returns false silently when user has no phone number
//   - Never throws — all errors are caught and logged
//   - Callers are never blocked by WhatsApp failures
//
// PREREQUISITES (set in Supabase Dashboard > Project Settings > Edge Functions):
//   WHATSAPP_PHONE_NUMBER_ID — from Meta Business > WhatsApp > API Setup
//   WHATSAPP_ACCESS_TOKEN    — permanent token from System User
//
// Meta pricing: ~$0.005/conversation (practically free at this scale)
// Template approval: templates must be pre-approved in Meta Business Manager
// ═══════════════════════════════════════════════════════════════

const META_API_VERSION = "v18.0";
const META_GRAPH_BASE = "https://graph.facebook.com";
const WHATSAPP_TIMEOUT_MS = 8_000;

export interface WhatsAppTextMessage {
  to: string;          // E.164 format: +919876543210
  body: string;        // Plain text, max 4096 chars
  previewUrl?: boolean;
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;      // Must be pre-approved in Meta Business Manager
  templateLanguage?: string; // default: "en"
  components?: Array<{
    type: "body" | "header" | "button";
    parameters: Array<{ type: "text"; text: string }>;
  }>;
}

export type WhatsAppSendResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

// ── Credential check ─────────────────────────────────────────────
function getWhatsAppCredentials(): { phoneNumberId: string; token: string } | null {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId || !token) return null;
  return { phoneNumberId, token };
}

// ── Phone number normaliser ──────────────────────────────────────
// Converts common India formats to E.164: +91XXXXXXXXXX
export function normaliseIndiaPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Remove all non-digit characters
  const digits = raw.replace(/\D/g, "");

  // Already in E.164 without +
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  // 10-digit India number
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  // International with country code
  if (digits.startsWith("0091") && digits.length === 14) return `+91${digits.slice(4)}`;
  // Already E.164-like (starts with +, has been stripped)
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;

  return null;
}

// ── Core send function ───────────────────────────────────────────
async function sendWhatsAppRaw(
  phoneNumberId: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<WhatsAppSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);

  try {
    const url = `${META_GRAPH_BASE}/${META_API_VERSION}/${phoneNumberId}/messages`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn(`[WhatsApp] API error ${resp.status}: ${body.slice(0, 200)}`);
      return { sent: false, reason: `api_error_${resp.status}` };
    }

    const data = await resp.json();
    const messageId = data?.messages?.[0]?.id ?? "unknown";
    return { sent: true, messageId };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      console.warn("[WhatsApp] Request timed out");
      return { sent: false, reason: "timeout" };
    }
    console.warn("[WhatsApp] Send failed:", err?.message ?? err);
    return { sent: false, reason: "network_error" };
  }
}

// ── Public API: send a free-text message ─────────────────────────
// Note: Free-form text only works within 24h of a user-initiated conversation.
// For proactive notifications, use sendWhatsAppTemplate instead.
export async function sendWhatsAppText(msg: WhatsAppTextMessage): Promise<WhatsAppSendResult> {
  const creds = getWhatsAppCredentials();
  if (!creds) return { sent: false, reason: "not_configured" };

  const phone = normaliseIndiaPhone(msg.to);
  if (!phone) return { sent: false, reason: "invalid_phone" };

  return sendWhatsAppRaw(creds.phoneNumberId, creds.token, {
    to: phone,
    type: "text",
    text: { body: msg.body, preview_url: msg.previewUrl ?? true },
  });
}

// ── Public API: send a template message ──────────────────────────
// Templates must be pre-approved. This is the right call for proactive
// notifications (score alerts, coaching nudges) since they fire outside
// the 24h free-text window.
//
// Template setup in Meta Business Manager:
//   Template name: "score_alert"
//   Category: UTILITY
//   Body: "⚠ Your career score has shifted. {{1}} — rescan now: {{2}}"
//   Parameters: [alert_text, rescan_url]
//
//   Template name: "coach_nudge"
//   Category: UTILITY
//   Body: "🧠 AI Career Coach: {{1}}\n\n{{2}}\n\nAct now: {{3}}"
//   Parameters: [nudge_title, nudge_message, action_url]
export async function sendWhatsAppTemplate(msg: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
  const creds = getWhatsAppCredentials();
  if (!creds) return { sent: false, reason: "not_configured" };

  const phone = normaliseIndiaPhone(msg.to);
  if (!phone) return { sent: false, reason: "invalid_phone" };

  return sendWhatsAppRaw(creds.phoneNumberId, creds.token, {
    to: phone,
    type: "template",
    template: {
      name: msg.templateName,
      language: { code: msg.templateLanguage ?? "en" },
      components: msg.components ?? [],
    },
  });
}

// ── Public API: send score alert (wraps template) ────────────────
export async function sendScoreAlertWhatsApp(
  phone: string,
  alertText: string,
  rescueUrl: string,
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: "score_alert",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: alertText.slice(0, 1024) },
          { type: "text", text: rescueUrl },
        ],
      },
    ],
  });
}

// ── Public API: send coach nudge (wraps template) ─────────────────
export async function sendCoachNudgeWhatsApp(
  phone: string,
  title: string,
  message: string,
  actionUrl: string,
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: "coach_nudge",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: title.slice(0, 512) },
          { type: "text", text: message.slice(0, 1024) },
          { type: "text", text: actionUrl },
        ],
      },
    ],
  });
}
