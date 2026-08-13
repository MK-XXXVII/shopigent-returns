// Test getOrdersByEmail functionality
// Run with: npx tsx scripts/test-orders-by-email.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const shop = "shopigent-kosmos.myshopify.com";
const email = "lucas.wilson@example.com";

async function main() {
  // Get the offline session
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
  });

  if (!session?.accessToken) {
    console.error("❌ No offline session found");
    return;
  }

  console.log("✅ Session found, accessToken:", session.accessToken.slice(0, 10) + "...");

  // Test 1: Customer search by email
  const url = `https://${shop}/admin/api/2026-10/customers/search.json?query=email:${encodeURIComponent(email)}`;
  console.log("\n🔍 Customer search URL:", url);

  const resp = await fetch(url, {
    headers: { "X-Shopify-Access-Token": session.accessToken },
  });
  const data = await resp.json();
  console.log("Response:", JSON.stringify(data, null, 2).slice(0, 2000));

  // Test 2: List all customers (first 5)
  const allUrl = `https://${shop}/admin/api/2026-10/customers.json?limit=5`;
  const allResp = await fetch(allUrl, {
    headers: { "X-Shopify-Access-Token": session.accessToken },
  });
  const allData = await allResp.json();
  console.log("\n📋 All customers (first 5):");
  if (allData.customers) {
    for (const c of allData.customers) {
      console.log(`  - ${c.first_name} ${c.last_name} (${c.email}) — ${c.orders_count} orders`);
    }
  } else {
    console.log("  No customers found or error:", JSON.stringify(allData).slice(0, 500));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});