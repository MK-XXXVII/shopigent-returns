import { json, type ActionFunctionArgs } from "@remix-run/node";
import * as crypto from "node:crypto";
import prisma from "../lib/db.server";

// DEV ONLY: Seed dummy data for screenshots
export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.slice(7);
  const hash = crypto.createHash("sha256").update(key || "").digest("hex");

  const authedShop = await prisma.shop.findFirst({ where: { mcpApiKeyHash: hash } });
  if (!authedShop) return json({ error: "Invalid API key" }, { status: 401 });

  const url = new URL(request.url);
  const targetShop = url.searchParams.get("shop") || authedShop.shop;

  const results: any = {};

  // 1. Seed policies (if not already seeded)
  const policyCount = await prisma.policy.count({ where: { shop: targetShop } });
  if (policyCount === 0) {
    const policies = [
      { name: "Standard 30-Day Return", description: "Auto-approved for items under $200. 0% restocking fee.", priority: 1, isActive: true, conditions: [{ field: "maxDays", operator: "lte", value: 30 }, { field: "maxAmount", operator: "lte", value: 200 }, { field: "autoApprove", operator: "eq", value: true }, { field: "restockingFee", operator: "eq", value: 0 }] },
      { name: "High-Value Review", description: "Items over $200 flagged for manual review. 10% restocking fee.", priority: 2, isActive: true, conditions: [{ field: "maxDays", operator: "lte", value: 30 }, { field: "minAmount", operator: "gt", value: 200 }, { field: "autoApprove", operator: "eq", value: false }, { field: "restockingFee", operator: "eq", value: 10 }] },
      { name: "Final Sale - Electronics", description: "Electronics, clearance, and custom items are non-returnable.", priority: 3, isActive: true, conditions: [{ field: "maxDays", operator: "lte", value: 0 }, { field: "autoApprove", operator: "eq", value: false }, { field: "restockingFee", operator: "eq", value: 0 }] },
    ];
    for (const p of policies) {
      await prisma.policy.create({ data: { ...p, shop: targetShop } });
    }
    results.policies = "✅ 3 policies created";
  } else {
    results.policies = `✅ ${policyCount} policies already exist`;
  }

  // 2. Seed dummy returns
  const returnCount = await prisma.returnRequest.count({ where: { shop: targetShop } });
  if (returnCount === 0) {
    const dummyReturns = [
      { orderName: "#1001", customerName: "Emma Wilson", customerEmail: "emma@example.com", status: "PENDING", reason: "Too small", items: [{ variantId: "gid://shopify/ProductVariant/1", title: "Classic Leather Jacket", quantity: 1, price: "299.99", sku: "LJ-001" }], createdAt: new Date("2026-08-10") },
      { orderName: "#1002", customerName: "James Chen", customerEmail: "james@example.com", status: "PENDING", reason: "Changed mind", items: [{ variantId: "gid://shopify/ProductVariant/2", title: "Wool Blend Scarf", quantity: 2, price: "45.00", sku: "SC-002" }, { variantId: "gid://shopify/ProductVariant/3", title: "Cashmere Beanie", quantity: 1, price: "35.00", sku: "BN-001" }], createdAt: new Date("2026-08-11") },
      { orderName: "#1003", customerName: "Sofia Rodriguez", customerEmail: "sofia@example.com", status: "PENDING", reason: "Defective stitching", items: [{ variantId: "gid://shopify/ProductVariant/4", title: "Linen Summer Dress", quantity: 1, price: "89.00", sku: "DR-003" }], createdAt: new Date("2026-08-12") },
      { orderName: "#1004", customerName: "Liam O'Brien", customerEmail: "liam@example.com", status: "APPROVED", reason: "Wrong size ordered", items: [{ variantId: "gid://shopify/ProductVariant/5", title: "Slim Fit Chinos", quantity: 1, price: "79.99", sku: "CH-004" }], decidedBy: "agent", decidedAt: new Date("2026-08-11"), refundAmount: 79.99, createdAt: new Date("2026-08-09") },
      { orderName: "#1005", customerName: "Anna Kowalski", customerEmail: "anna@example.com", status: "REFUNDED", reason: "Arrived damaged", items: [{ variantId: "gid://shopify/ProductVariant/6", title: "Ceramic Mug Set", quantity: 1, price: "34.99", sku: "MG-005" }], decidedBy: "agent", decidedAt: new Date("2026-08-10"), refundAmount: 34.99, refundId: "txn_001", createdAt: new Date("2026-08-08") },
      { orderName: "#1006", customerName: "Marcus Johnson", customerEmail: "marcus@example.com", status: "DENIED", reason: "Return window exceeded", items: [{ variantId: "gid://shopify/ProductVariant/7", title: "Wool Winter Coat", quantity: 1, price: "450.00", sku: "CT-006" }], decidedBy: "agent", decidedAt: new Date("2026-08-11"), notes: "Return window exceeded (45 days, policy max 30)", createdAt: new Date("2026-08-05") },
      { orderName: "#1007", customerName: "Yuki Tanaka", customerEmail: "yuki@example.com", status: "EXCHANGE", reason: "Want different color", items: [{ variantId: "gid://shopify/ProductVariant/8", title: "Merino Wool Sweater", quantity: 1, price: "129.00", sku: "SW-007" }], decidedBy: "agent", decidedAt: new Date("2026-08-12"), createdAt: new Date("2026-08-10") },
    ];

    for (const r of dummyReturns) {
      const created = await prisma.returnRequest.create({
        data: { ...r, shop: targetShop, orderId: r.orderName, items: r.items, refundAmount: (r as any).refundAmount, refundId: (r as any).refundId, decidedBy: (r as any).decidedBy, decidedAt: (r as any).decidedAt as Date | null, notes: (r as any).notes as string | null },
      });

      // Add decision logs for processed returns
      if (r.status !== "PENDING") {
        await prisma.decisionLog.create({
          data: {
            returnId: created.id,
            actor: "agent",
            action: r.status === "DENIED" ? "deny" : r.status === "EXCHANGE" ? "exchange" : "approve",
            details: { status: r.status, reason: r.reason, refundAmount: (r as any).refundAmount },
          },
        });
      }

      // Add fraud signals for some returns
      if (r.customerName === "Marcus Johnson") {
        await prisma.fraudSignal.create({
          data: { returnId: created.id, signal: "return_window_exceeded", risk: "high", details: { daysSinceOrder: 45, policyMax: 30 } },
        });
      }
      if (r.customerName === "Emma Wilson") {
        await prisma.fraudSignal.create({
          data: { returnId: created.id, signal: "high_value_return", risk: "medium", details: { amount: 299.99, threshold: 200 } },
        });
      }
    }
    results.returns = "✅ 7 returns created (3 PENDING, 1 APPROVED, 1 REFUNDED, 1 DENIED, 1 EXCHANGE)";
  } else {
    results.returns = `✅ ${returnCount} returns already exist`;
  }

  results.shop = targetShop;
  return json({ ok: true, ...results });
};