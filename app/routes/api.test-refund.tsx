import { json, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "../lib/db.server";
import { executeRefund } from "../lib/shopify-admin.server";
import { sendEmail, refundProcessedEmail } from "../lib/email.server";
import shopify from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.json().catch(() => ({}));
  const returnId = formData.returnId;
  const shop = session.shop;

  const returnReq = await prisma.returnRequest.findFirst({
    where: { id: returnId, shop },
  });
  if (!returnReq) return json({ error: "Not found" }, { status: 404 });
  if (returnReq.status !== "APPROVED") return json({ error: "Return must be APPROVED" });

  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  if (!sess?.accessToken) return json({ error: "No access token" });

  const items = returnReq.items as any[];
  const amount = items.reduce((s: number, i: any) => s + (parseFloat(i.price || "0") * (i.quantity || 0)), 0);
  const orderId = returnReq.orderId;

  try {
    const result = await executeRefund(shop, sess.accessToken, orderId, amount, true);
    await prisma.returnRequest.update({
      where: { id: returnId },
      data: { status: "REFUNDED", refundAmount: amount, refundId: result?.id || null },
    });
    await prisma.decisionLog.create({ data: { returnId, actor: "admin", action: "refund", details: { refundId: result?.id } } });
    if (returnReq.customerEmail) sendEmail({ ...refundProcessedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", amount), to: returnReq.customerEmail });
    return json({ success: true, refundId: result?.id });
  } catch (err: any) {
    return json({ error: err.message, details: err.stack }, { status: 500 });
  }
};