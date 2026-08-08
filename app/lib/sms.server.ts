// SMS notification service
// Two-tier delivery:
//   1. Email-to-SMS gateways via VPS mail relay (same as email.server.ts) — no API key needed
//   2. Optional Twilio for Pro plan (uses TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN env vars)
//
// Carrier gateways: phone@gateway (e.g., 15551234567@vtext.com)
// The relay posts an email body that the carrier converts to SMS.

const RELAY_URL = process.env.MAIL_RELAY_URL || "http://localhost:8787/send";
const RELAY_KEY = process.env.MAIL_RELAY_KEY || "";
const FROM = process.env.EMAIL_FROM || "Shopigent Returns <returns@shopigent.com>";

// Twilio (optional — Pro plan)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE = process.env.TWILIO_PHONE || ""; // e.g., +15551234567

// ─── Carrier gateway domains ───────────────────────────────────────────────
// Maps carrier name → email-to-SMS gateway domain.
// Add more carriers as needed (e.g., visiblepcs.com, boostmobile.com, etc.)
const CARRIER_GATEWAYS: Record<string, string> = {
  verizon: "vtext.com",
  vzw: "vtext.com",
  "t-mobile": "tmomail.net",
  tmobile: "tmomail.net",
  att: "txt.att.net",
  "at&t": "txt.att.net",
  sprint: "messaging.sprintpcs.com",
  "google-fi": "msg.fi.google.com",
  googlefi: "msg.fi.google.com",
  "us-cellular": "email.uscc.net",
  uscellular: "email.uscc.net",
};

/** Normalise a phone number to digits-only (strip +, -, (, ), ., space) */
function digitsOnly(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Send an SMS via email-to-SMS gateway using the VPS mail relay.
 * Falls back gracefully when RELAY_KEY is unset.
 */
async function sendViaRelay(
  gatewayAddress: string,
  message: string,
): Promise<boolean> {
  if (!RELAY_KEY) {
    console.log("[sms] No MAIL_RELAY_KEY configured, skipping email-to-SMS relay");
    return false;
  }

  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-key": RELAY_KEY,
      },
      body: JSON.stringify({
        to: gatewayAddress,
        subject: "SMS Notification", // carriers often ignore subject
        text: message,
        html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(`[sms] Relay failed: ${response.status}`);
      return false;
    }

    console.log(`[sms] Sent via relay to ${gatewayAddress}`);
    return true;
  } catch (err: any) {
    console.error(`[sms] Relay error: ${err.message}`);
    return false;
  }
}

/**
 * Send an SMS via Twilio REST API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE to be set.
 */
async function sendViaTwilio(
  toPhone: string,
  message: string,
): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
    console.log("[sms] Twilio not configured, skipping");
    return false;
  }

  // Ensure E.164 format (add + if missing)
  const formattedTo = toPhone.startsWith("+") ? toPhone : `+${digitsOnly(toPhone)}`;
  const formattedFrom = TWILIO_PHONE.startsWith("+") ? TWILIO_PHONE : `+${digitsOnly(TWILIO_PHONE)}`;

  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const body = new URLSearchParams({
      To: formattedTo,
      From: formattedFrom,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[sms] Twilio failed: ${response.status} — ${errBody}`);
      return false;
    }

    console.log(`[sms] Sent via Twilio to ${formattedTo}`);
    return true;
  } catch (err: any) {
    console.error(`[sms] Twilio error: ${err.message}`);
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface SmsPayload {
  /** Phone number (digits-only, with or without + prefix) */
  to: string;
  /** SMS message body */
  message: string;
}

/**
 * Send an SMS notification.
 *
 * Priority:
 *   1. Twilio — if TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE are all set
 *   2. Email-to-SMS gateway via VPS mail relay — uses `carrier` to build gateway address
 *
 * @param to       Phone number E.164 format or digits-only
 * @param message  SMS body text
 * @param carrier  Carrier name (default: "verizon"). Ignored when using Twilio.
 *                 Known carriers: verizon, t-mobile, att, sprint, google-fi, us-cellular
 */
export async function sendSms(
  to: string,
  message: string,
  carrier: string = "verizon",
): Promise<boolean> {
  const digits = digitsOnly(to);
  if (!digits || digits.length < 10) {
    console.error(`[sms] Invalid phone number: "${to}"`);
    return false;
  }
  if (!message || message.trim().length === 0) {
    console.error("[sms] Empty message");
    return false;
  }

  // Truncate long messages (most carriers limit to 160 chars per segment)
  const truncated = message.length > 160 ? message.slice(0, 157) + "..." : message;

  // 1. Try Twilio if configured
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE) {
    return sendViaTwilio(digits, truncated);
  }

  // 2. Fall back to email-to-SMS gateway
  const domain = CARRIER_GATEWAYS[carrier.toLowerCase()];
  if (!domain) {
    console.error(`[sms] Unknown carrier: "${carrier}". Valid: ${Object.keys(CARRIER_GATEWAYS).join(", ")}`);
    return false;
  }

  const gatewayAddress = `${digits}@${domain}`;
  return sendViaRelay(gatewayAddress, truncated);
}