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
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RELAY_KEY) {
    console.log("[email] No MAIL_RELAY_KEY configured, skipping");
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
        to: payload.to,
        subject: payload.subject,
        text: payload.html.replace(/<[^>]*>/g, ""), // strip HTML for plain text fallback
        html: payload.html,
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

// Email templates
export function returnReceivedEmail(customerName: string, orderName: string, returnId: string): EmailPayload {
  return {
    to: "",
    subject: `Return Request Received — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#5c6ac4">Return Request Received</h2>
      <p>Hi ${customerName},</p>
      <p>We've received your return request for order <strong>${orderName}</strong>.</p>
      <p>Your return ID: <strong>${returnId.slice(0, 8)}</strong></p>
      <p>We'll review it and notify you once a decision is made.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`,
  };
}

export function returnApprovedEmail(customerName: string, orderName: string, refundAmount?: number): EmailPayload {
  const refundLine = refundAmount ? `<p>Refund amount: <strong>$${refundAmount.toFixed(2)}</strong></p>` : "";
  return {
    to: "",
    subject: `Return Approved — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#50b83c">✅ Return Approved</h2>
      <p>Hi ${customerName},</p>
      <p>Your return for order <strong>${orderName}</strong> has been approved!</p>
      ${refundLine}
      <p>Your refund will be processed within 3-5 business days.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`,
  };
}

export function returnDeniedEmail(customerName: string, orderName: string, reason: string): EmailPayload {
  return {
    to: "",
    subject: `Return Update — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#de3617">Return Update</h2>
      <p>Hi ${customerName},</p>
      <p>After reviewing your return request for order <strong>${orderName}</strong>, we're unable to approve it.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you have questions, please contact support.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`,
  };
}

export function storeCreditProcessedEmail(customerName: string, orderName: string, amount: number, discountCode: string): EmailPayload {
  return {
    to: "",
    subject: `Store Credit Issued — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#47c1bf">🎉 Store Credit Issued</h2>
      <p>Hi ${customerName},</p>
      <p>Your store credit of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been issued.</p>
      <p>Use code <strong>${discountCode}</strong> on your next purchase.</p>
      <p>The code expires in 1 year.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`,
  };
}

export function refundProcessedEmail(customerName: string, orderName: string, amount: number): EmailPayload {
  return {
    to: "",
    subject: `Refund Processed — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#47c1bf">💰 Refund Processed</h2>
      <p>Hi ${customerName},</p>
      <p>Your refund of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been processed.</p>
      <p>The refund will appear on your payment method within 3-5 business days.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`,
  };
}