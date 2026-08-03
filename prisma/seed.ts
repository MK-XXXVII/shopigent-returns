#!/usr/bin/env node
// Shopigent Returns — Seed script
// Creates test data for development/demo purposes.
// Usage: DATABASE_URL="..." npx tsx prisma/seed.ts
// Or from Railway: railway run --service returns-app "npx tsx prisma/seed.ts"

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = "bundlebuzz-store.myshopify.com";

const statuses = ["PENDING", "APPROVED", "DENIED", "REFUNDED", "EXCHANGE"] as const;

const items = [
  { variantId: "gid://shopify/ProductVariant/1", title: "Classic Leather Jacket", quantity: 1, price: "299.99", sku: "CLJ-001" },
  { variantId: "gid://shopify/ProductVariant/2", title: "Wool Blend Sweater", quantity: 2, price: "89.99", sku: "WBS-002" },
  { variantId: "gid://shopify/ProductVariant/3", title: "Denim Jeans - Slim Fit", quantity: 1, price: "79.99", sku: "DJ-SF-003" },
  { variantId: "gid://shopify/ProductVariant/4", title: "Running Shoes - Size 10", quantity: 1, price: "129.99", sku: "RS-10-004" },
  { variantId: "gid://shopify/ProductVariant/5", title: "Cotton T-Shirt Pack (3)", quantity: 1, price: "45.00", sku: "CTP-005" },
  { variantId: "gid://shopify/ProductVariant/6", title: "Leather Belt - Brown", quantity: 1, price: "59.99", sku: "LB-BR-006" },
  { variantId: "gid://shopify/ProductVariant/7", title: "Winter Parka - XL", quantity: 1, price: "199.99", sku: "WP-XL-007" },
  { variantId: "gid://shopify/ProductVariant/8", title: "Silk Scarf - Printed", quantity: 1, price: "34.99", sku: "SS-P-008" },
];

const customers = [
  { name: "Maria Papadopoulou", email: "maria.p@example.com" },
  { name: "Giorgos Karamanlis", email: "giorgos.k@example.com" },
  { name: "Eleni Nikolaou", email: "eleni.n@example.com" },
  { name: "Dimitris Alexiou", email: "dimitris.a@example.com" },
  { name: "Sophia Michael", email: "sophia.m@example.com" },
];

const reasons = [
  "Item doesn't fit - too small",
  "Changed my mind",
  "Defective - zipper broken",
  "Color different from photo",
  "Received wrong size",
  "Quality not as expected",
  "Duplicate order",
  "No longer needed",
];

async function main() {
  console.log(`🌱 Seeding test data for shop: ${SHOP}`);

  // Ensure shop record exists
  await prisma.shop.upsert({
    where: { shop: SHOP },
    create: { id: SHOP, shop: SHOP, name: "BundleBuzz Store" },
    update: {},
  });

  // Delete existing test data
  await prisma.decisionLog.deleteMany({ where: { return: { shop: SHOP } } });
  await prisma.fraudSignal.deleteMany({ where: { return: { shop: SHOP } } });
  await prisma.returnRequest.deleteMany({ where: { shop: SHOP } });
  console.log("  ✓ Cleared existing returns");

  // Create policies if none exist
  const policyCount = await prisma.policy.count({ where: { shop: SHOP } });
  if (policyCount === 0) {
    await prisma.policy.create({
      data: {
        shop: SHOP,
        name: "Standard 30-day return",
        description: "Auto-approve orders under $200 within 30 days. No restocking fee.",
        priority: 0,
        isActive: true,
        conditions: [
          { field: "maxDays", operator: "lte", value: 30 },
          { field: "maxAmount", operator: "lte", value: 200 },
          { field: "autoApprove", operator: "eq", value: true },
          { field: "restockingFee", operator: "eq", value: 0 },
          { field: "requiresReturnLabel", operator: "eq", value: true },
        ],
      },
    });
    await prisma.policy.create({
      data: {
        shop: SHOP,
        name: "High-value review required",
        description: "Orders over $200 need manual review. 15% restocking fee after 14 days.",
        priority: 1,
        isActive: true,
        conditions: [
          { field: "maxDays", operator: "lte", value: 30 },
          { field: "maxAmount", operator: "lte", value: 9999 },
          { field: "autoApprove", operator: "eq", value: false },
          { field: "restockingFee", operator: "eq", value: 15 },
          { field: "requiresReturnLabel", operator: "eq", value: true },
        ],
      },
    });
    console.log("  ✓ Created 2 default policies");
  }

  // Create 15 test returns
  for (let i = 0; i < 15; i++) {
    const customer = customers[i % customers.length];
    const status = statuses[i % statuses.length];
    const numItems = (i % 3) + 1;
    const selectedItems = items.slice(i % 5, (i % 5) + numItems);
    const totalAmount = selectedItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const returnReq = await prisma.returnRequest.create({
      data: {
        shop: SHOP,
        orderId: `gid://shopify/Order/${1000 + i}`,
        orderName: `#BZ-${2026000 + i}`,
        customerEmail: customer.email,
        customerName: customer.name,
        items: selectedItems,
        reason: reasons[i % reasons.length],
        status,
        decidedBy: status !== "PENDING" ? "agent" : null,
        decidedAt: status !== "PENDING" ? new Date() : null,
        refundAmount: status === "REFUNDED" ? totalAmount * 0.9 : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Add fraud signals for some returns
    if (i % 4 === 0) {
      await prisma.fraudSignal.create({
        data: {
          returnId: returnReq.id,
          signal: "frequent_returner",
          score: 0.45,
          details: { returnsIn30Days: 3 },
        },
      });
    }

    // Add decision logs for non-pending returns
    if (status !== "PENDING") {
      const action = status === "APPROVED" ? "approve" : status === "DENIED" ? "deny" : status === "REFUNDED" ? "refund" : "exchange";
      await prisma.decisionLog.create({
        data: {
          returnId: returnReq.id,
          actor: "agent",
          action,
          details: { reasoning: `Auto-${action} based on policy evaluation`, policy: "Standard 30-day return" },
          createdAt,
        },
      });
      if (status === "REFUNDED") {
        await prisma.decisionLog.create({
          data: {
            returnId: returnReq.id,
            actor: "system",
            action: "refund_executed",
            details: { amount: totalAmount * 0.9, transactionId: `txn_${1000 + i}` },
            createdAt: new Date(createdAt.getTime() + 3600000),
          },
        });
      }
    }

    console.log(`  ✓ Created return ${i + 1}/15: ${returnReq.orderName} (${
      selectedItems.map(i => i.title).join(", ").slice(0, 40)
    }) → ${status}`);
  }

  console.log(`\n✅ Done! Created 15 test returns for ${SHOP}`);
  console.log("   Run railway up to redeploy the app, or use the MCP tools to test.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());