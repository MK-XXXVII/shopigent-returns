// Verify returns/update webhook is registered in Shopify
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const shop = "shopigent-kosmos.myshopify.com";
  const session = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = session?.accessToken || (await prisma.session.findFirst({ where: { shop } }))?.accessToken;
  if (!token) { console.error("No access token"); return; }

  // Query webhook subscriptions via GraphQL
  const query = `{ webhookSubscriptions(first: 50) { edges { node { ... on WebhookSubscription { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } } } } } }`;
  const res = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  const subs = data?.data?.webhookSubscriptions?.edges?.map((e: any) => e.node) || [];
  console.log("\n=== Registered webhooks ===");
  for (const s of subs) {
    console.log(`• ${s.topic} → ${s.endpoint?.callbackUrl}`);
  }
  const hasReturns = subs.some((s: any) => s.topic === "RETURNS_UPDATE");
  console.log(`\nRETURNS_UPDATE registered: ${hasReturns ? "✅ YES" : "❌ NO"}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
