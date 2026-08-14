// Live sync: query the Shopify return status for a return and update our DB
import prisma from "./db.server";

const API = "2026-10";

export async function shopifyQuery(shop: string, token: string, query: string, vars?: any) {
  const res = await fetch(`https://${shop}/admin/api/${API}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables: vars }),
  });
  return res.json();
}

// Map Shopify Return status → our ReturnStatus
export function mapShopifyReturnStatus(shopifyStatus: string | undefined): string {
  switch ((shopifyStatus || "").toUpperCase()) {
    case "OPEN": return "APPROVED";
    case "PARTIALLY_REFUNDED": return "APPROVED";
    case "REFUNDED":
    case "COMPLETED": return "REFUNDED";
    case "CANCELLED":
    case "DECLINED": return "DENIED";
    case "REQUESTED": return "PENDING";
    case "CLOSED": return "CLOSED";
    case "REVIEWING": return "PENDING";
    default: return (shopifyStatus || "PENDING").toUpperCase();
  }
}

// Query Shopify for a return's current status by its id, update our record if changed
export async function syncReturnFromShopify(shop: string, shopifyReturnId: string | null, ourReturnId: string): Promise<string | null> {
  if (!shopifyReturnId) return null;

  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || (await prisma.session.findFirst({ where: { shop } }))?.accessToken;
  if (!token) return null;

  const q = `{ return(id: "${shopifyReturnId}") { id status refundAmount } }`;
  const data = await shopifyQuery(shop, token, q);

  const shopifyStatus = data?.data?.return?.status;
  if (!shopifyStatus) return null;

  const mapped = mapShopifyReturnStatus(shopifyStatus);

  const our = await prisma.returnRequest.findUnique({ where: { id: ourReturnId } });
  if (!our) return null;

  // Don't downgrade a refunded return
  if (our.status === "REFUNDED" && mapped === "APPROVED") {
    return our.status;
  }

  if (our.status !== mapped) {
    const updates: any = { status: mapped };
    const refundAmount = data?.data?.return?.refundAmount;
    if (refundAmount != null) updates.refundAmount = parseFloat(refundAmount);
    await prisma.returnRequest.update({ where: { id: ourReturnId }, data: updates });
    await prisma.decisionLog.create({
      data: { returnId: ourReturnId, actor: "shopify_sync", action: "status_sync", details: { from: our.status, to: mapped, shopifyStatus } },
    });
    console.log(`[sync] ${ourReturnId}: ${our.status} → ${mapped} (Shopify ${shopifyStatus})`);
    return mapped;
  }
  return our.status;
}
