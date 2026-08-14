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
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || (await prisma.session.findFirst({ where: { shop } }))?.accessToken;
  if (!token) return null;

  const our = await prisma.returnRequest.findUnique({ where: { id: ourReturnId } });
  if (!our) return null;
  const orderId = our.orderId;

  console.log(`[sync] Starting for return ${ourReturnId}, orderId=${orderId}, shopifyReturnId=${shopifyReturnId}, shop=${shop}`);

  // Find the Shopify return by ID, or by order if no ID stored
  let shopifyReturn: any = null;

  // Fetch Shopify returns for the order
  const orderGid = orderId?.startsWith("gid://") ? orderId : orderId ? `gid://shopify/Order/${orderId}` : null;
  let q: string;

  if (shopifyReturnId) {
    q = `{ return(id: "${shopifyReturnId}") { id status order { id name } returnLineItems(first: 10) { nodes { id status } } } }`;
  } else if (orderGid) {
    q = `{ order(id: "${orderGid}") { id name returns(first: 5) { nodes { id status } } } }`;
  } else {
    return null;
  }

  const data = await shopifyQuery(shop, token, q);
  if (shopifyReturnId) {
    shopifyReturn = data?.data?.return;
  } else {
    const returns = data?.data?.order?.returns?.nodes || [];
    if (returns.length > 0) {
      shopifyReturn = returns[0]; // take most recent
      // Save the shopifyReturnId for future lookups
      await prisma.returnRequest.update({ where: { id: ourReturnId }, data: { shopifyReturnId: shopifyReturn.id } });
    }
  }

  if (!shopifyReturn) {
    console.log(`[sync] No return found in Shopify response for ${ourReturnId}:`, JSON.stringify(data?.errors || data?.data).slice(0, 300));
    return null;
  }

  const mapped = mapShopifyReturnStatus(shopifyReturn.status);

  // Don't downgrade a refunded return
  if (our.status === "REFUNDED" && mapped === "APPROVED") {
    return our.status;
  }

  if (our.status !== mapped) {
    await prisma.returnRequest.update({ where: { id: ourReturnId }, data: { status: mapped as any } });
    await prisma.decisionLog.create({
      data: { returnId: ourReturnId, actor: "shopify_sync", action: "status_sync", details: { from: our.status, to: mapped, shopifyStatus: shopifyReturn.status } },
    });
    console.log(`[sync] ${ourReturnId}: ${our.status} → ${mapped} (Shopify ${shopifyReturn.status})`);
    return mapped;
  }
  return our.status;
}
