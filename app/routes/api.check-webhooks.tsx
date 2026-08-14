export async function action({ request, json, crypto, prisma }: any) {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, { status: 401 });
  const hash = crypto.createHash("sha256").update(authHeader.slice(7)).digest("hex");
  const shopRec = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!shopRec) return json({ error: "Unauthorized" }, { status: 401 });
  const shop = "shopigent-kosmos.myshopify.com";
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || (await prisma.session.findFirst({ where: { shop } }))?.accessToken;
  if (!token) return json({ error: "No token" }, { status: 500 });

  const q = `{ return(id: "gid://shopify/Return/22487662747") { id status refundAmount } }`;
  const gRes = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: q }),
  });
  const data = await gRes.json();
  return json({ shopify: data });
}
