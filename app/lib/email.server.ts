// Email notification service for Shopigent Returns
// Supports: Resend (default + merchant-provided key)
// No SMTP — Railway blocks outbound SMTP on Hobby plan

const RESEND_API = "https://api.resend.com/emails";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_SHOPIGENT;
  if (!apiKey) {
    console.log("[email] No RESEND_API_KEY configured, skipping");
    return false;
  }

  const from = process.env.EMAIL_FROM || "Shopigent Returns <returns@shopigent.com>";

  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[email] Failed: ${err}`);
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
      <p>We'll review your request and notify you once a decision is made.</p>
      <hr style="border:1px solid #eee"/>
      <p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
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
      <hr style="border:1px solid #eee"/>
      <p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
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
      <p>After reviewing your return request for order <strong>${orderName}</strong>, we're unable to approve it at this time.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you have questions, please contact our support team.</p>
      <hr style="border:1px solid #eee"/>
      <p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
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
      <p>The refund will appear on your original payment method within 3-5 business days.</p>
      <hr style="border:1px solid #eee"/>
      <p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`,
  };
}