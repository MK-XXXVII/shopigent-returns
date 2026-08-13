import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import { issueConfirmationToken, verifyConfirmationToken } from "../lib/confirmation.server";
import { executeRefund } from "../lib/shopify-admin.server";
import { sendEmail, returnApprovedEmail, returnDeniedEmail } from "../lib/email.server";
import prisma from "../lib/db.server";

// Quick approve/deny from the list buttons
// POST /api/quick-action with { action, returnId }
export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));

  // Support both Bearer token (MCP) and session-based auth
  let shop: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7);
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const shopRec = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
    if (!shopRec) return json({ error: "Unauthorized" }, { status: 401 });
    shop = shopRec.shop;
  } else {
    // Session-based auth (from embedded app)
    try {
      const { session } = await requireShopifyAuth(request);
      shop = session.shop;
    } catch {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { action, returnId, confirmationToken } = body;

  if (!action || !returnId) {
    return json({ error: "Missing action or returnId" }, { status: 400 });
  }

  // Find the return
  const returnReq = await prisma.returnRequest.findFirst({
    where: { id: returnId, shop },
  });

  if (!returnReq) return json({ error: "Return not found" }, { status: 404 });
  if (returnReq.status !== "PENDING") {
    return json({ error: `Return is already ${returnReq.status}` }, { status: 400 });
  }

  if (action === "issue_token") {
    // Issue a confirmation token (first step)
    const secret = process.env.CONFIRMATION_TOKEN_SECRET;
    if (!secret) return json({ error: "Confirmation not configured" }, { status: 500 });

    const token = issueConfirmationToken(secret, shop, body.targetAction || "approve_return", returnId, { returnId });
    return json({ token, expiresInMs: 300000 });
  }

  if (action === "approve") {
    // Verify confirmation token
    const secret = process.env.CONFIRMATION_TOKEN_SECRET;
    if (!secret) return json({ error: "Confirmation not configured" }, { status: 500 });
    if (!confirmationToken) return json({ error: "Use issue_token first, then approve with the token" }, { status: 400 });

    const check = verifyConfirmationToken(confirmationToken, secret, shop, "approve_return", returnId, { returnId });
    if (!check.valid) return json({ error: `Confirmation failed: ${check.reason}` }, { status: 400 });

    // Atomic claim
    const claim = await prisma.returnRequest.updateMany({
      where: { id: returnId, status: "PENDING" },
      data: { status: "APPROVED", decidedBy: "admin", decidedAt: new Date() },
    });
    if (claim.count === 0) return json({ error: "Return already processed" }, { status: 400 });

    // Try refund via Shopify
    const session = await prisma.session.findFirst({ where: { shop, isOnline: false } });
    if (session?.accessToken) {
      try {
        const items = returnReq.items as any[];
        const total = items.reduce((s: number, i: any) => s + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);
        await executeRefund(shop, session.accessToken, returnReq.orderId, total, true);
      } catch {}
    }

    // Log
    await prisma.decisionLog.create({
      data: { returnId, actor: "admin", action: "approve", details: { source: "list_button" } },
    });

    // Email
    if (returnReq.customerEmail && returnReq.customerName) {
      sendEmail({ ...returnApprovedEmail(returnReq.customerName, returnReq.orderName || ""), to: returnReq.customerEmail });
    }

    return json({ success: true, message: "Return approved" });
  }

  if (action === "deny") {
    const secret = process.env.CONFIRMATION_TOKEN_SECRET;
    if (!secret) return json({ error: "Confirmation not configured" }, { status: 500 });
    if (!confirmationToken) return json({ error: "Use issue_token first, then deny with the token" }, { status: 400 });

    const check = verifyConfirmationToken(confirmationToken, secret, shop, "deny_return", returnId, { returnId });
    if (!check.valid) return json({ error: `Confirmation failed: ${check.reason}` }, { status: 400 });

    const claim = await prisma.returnRequest.updateMany({
      where: { id: returnId, status: "PENDING" },
      data: { status: "DENIED", decidedBy: "admin", decidedAt: new Date(), notes: "Denied by store admin" },
    });
    if (claim.count === 0) return json({ error: "Return already processed" }, { status: 400 });

    await prisma.decisionLog.create({
      data: { returnId, actor: "admin", action: "deny", details: { source: "list_button" } },
    });

    if (returnReq.customerEmail && returnReq.customerName) {
      sendEmail({ ...returnDeniedEmail(returnReq.customerName, returnReq.orderName || "", "Denied by store admin"), to: returnReq.customerEmail });
    }

    return json({ success: true, message: "Return denied" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};