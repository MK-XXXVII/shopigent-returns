// Email notification service
// Uses VPS mail relay (Gmail SMTP via localhost) — no Resend needed
// Railway → HTTP POST → VPS relay → Gmail SMTP

const RELAY_URL = process.env.MAIL_RELAY_URL || "http://localhost:8787/send";
const RELAY_KEY = process.env.MAIL_RELAY_KEY || "";
const FROM = process.env.EMAIL_FROM || "Shopigent Returns <returns@shopigent.com>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  from?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RELAY_KEY) {
    console.log("[email] No MAIL_RELAY_KEY configured, skipping");
    return false;
  }

  // Default sender name unless overridden
  const fromName = payload.fromName || "Shopigent Returns";
  const from = payload.from || "shopigent@greeknous.com";

  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-key": RELAY_KEY,
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        text: payload.html.replace(/<[^>]*>/g, ""), // strip HTML for plain text fallback
        html: payload.html,
        fromName,
        from: payload.from || from,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(`[email] Relay failed: ${response.status}`);
      return false;
    }

    console.log(`[email] Sent to ${payload.to}: ${payload.subject}`);
    return true;
  } catch (err: any) {
    console.error(`[email] Error: ${err.message}`);
    return false;
  }
}

// ── Shared email layout with logo ──────────────────────
const APP_URL = process.env.APP_URL || "https://returns.greeknous.com";
const LOGO_HTML = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
  <tr>
    <td>
      <a href="${APP_URL}" style="text-decoration:none">
        <img src="${APP_URL}/logo-email.svg" alt="Shopigent Returns" width="160" height="32" style="display:block" />
      </a>
    </td>
  </tr>
</table>`;
const FOOTER_HTML = `<hr><p style="color:#6b7280;font-size:12px;text-align:center">Shopigent Returns — AI-powered return management</p>`;

function emailBody(inner: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:8px;border:1px solid #e1e3e5">
    ${LOGO_HTML}
    ${inner}
    ${FOOTER_HTML}
  </div>`;
}

// Email templates
export function returnReceivedEmail(customerName: string, orderName: string, returnId: string): EmailPayload {
  return {
    to: "",
    subject: `Return Request Received — ${orderName}`,
    html: emailBody(`
      <h2 style="color:#5c6ac4;margin-top:0">Return Request Received</h2>
      <p>Hi ${customerName},</p>
      <p>We've received your return request for order <strong>${orderName}</strong>.</p>
      <p>Your return ID: <strong>${returnId.slice(0, 8)}</strong></p>
      <p>We'll review it and notify you once a decision is made.</p>
    `),
  };
}

export function returnApprovedEmail(customerName: string, orderName: string, refundAmount?: number): EmailPayload {
  const refundLine = refundAmount ? `<p>Refund amount: <strong>$${refundAmount.toFixed(2)}</strong></p>` : "";
  return {
    to: "",
    subject: `Return Approved — ${orderName}`,
    html: emailBody(`
      <h2 style="color:#50b83c;margin-top:0">✅ Return Approved</h2>
      <p>Hi ${customerName},</p>
      <p>Your return for order <strong>${orderName}</strong> has been approved!</p>
      ${refundLine}
      <p>Your refund will be processed within 3-5 business days.</p>
    `),
  };
}

export function returnDeniedEmail(customerName: string, orderName: string, reason: string): EmailPayload {
  return {
    to: "",
    subject: `Return Update — ${orderName}`,
    html: emailBody(`
      <h2 style="color:#de3617;margin-top:0">Return Update</h2>
      <p>Hi ${customerName},</p>
      <p>After reviewing your return request for order <strong>${orderName}</strong>, we're unable to approve it.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you have questions, please contact support.</p>
    `),
  };
}

export function storeCreditProcessedEmail(customerName: string, orderName: string, amount: number, discountCode: string): EmailPayload {
  return {
    to: "",
    subject: `Store Credit Issued — ${orderName}`,
    html: emailBody(`
      <h2 style="color:#47c1bf;margin-top:0">🎉 Store Credit Issued</h2>
      <p>Hi ${customerName},</p>
      <p>Your store credit of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been issued.</p>
      <p>Use code <strong>${discountCode}</strong> on your next purchase.</p>
      <p>The code expires in 1 year.</p>
    `),
  };
}

export function refundProcessedEmail(customerName: string, orderName: string, amount: number): EmailPayload {
  return {
    to: "",
    subject: `Refund Processed — ${orderName}`,
    html: emailBody(`
      <h2 style="color:#47c1bf;margin-top:0">💰 Refund Processed</h2>
      <p>Hi ${customerName},</p>
      <p>Your refund of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been processed.</p>
      <p>The refund will appear on your payment method within 3-5 business days.</p>
    `),
  };
}

export function returnLabelEmail(
  customerName: string,
  orderName: string,
  labelUrl: string,
  trackingNumber?: string,
  storeName?: string
): EmailPayload {
  const trackingLine = trackingNumber
    ? `<p>Tracking number: <strong>${trackingNumber}</strong></p>`
    : "";
  const storeSuffix = storeName ? ` - ${storeName}` : "";
  return {
    to: "",
    subject: `📦 Your Return Shipping Label - ${orderName}${storeSuffix}`,
    html: emailBody(`
      <h2 style="color:#5c6ac4;margin-top:0">📦 Your Return Shipping Label</h2>
      <p>Hi ${customerName},</p>
      <p>Your return for order <strong>${orderName}</strong> has been approved. Please use the label below to send your item(s) back to us.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${labelUrl}" target="_blank" style="background:#5c6ac4;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Download Return Label</a>
      </div>
      ${trackingLine}
      <p style="color:#6b7280">Attach this label to your package and drop it off at any shipping point of the carrier. Keep a copy for your records.</p>
    `),
  };
}