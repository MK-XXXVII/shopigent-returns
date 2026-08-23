// DEV ONLY — Seed real Shopify orders into return requests across statuses.
// Renders as a normal Polaris page inside the Shopify admin (requires auth).
// Use this to generate data for listing screenshots, then clear when done.
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Page, Card, BlockStack, Text, Banner, Button, InlineStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { shopifyAdminQuery } from "../lib/shopify-admin.server";

// ── Fetch orders + line items from Shopify ────────────────────────
async function fetchOrders(shop: string, token: string) {
  const q = `{
    orders(first: 40, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id name email createdAt displayFinancialStatus
        lineItems(first: 10) { edges { node {
          id title quantity sku variant { id }
          originalUnitPriceSet { shopMoney { amount } }
        } } }
      } }
    }
  }`;
  const r = await shopifyAdminQuery(shop, token, q);
  return (r?.data?.orders?.edges || []).map((e: any) => ({
    id: e.node.id.replace("gid://shopify/Order/", ""),
    gid: e.node.id,
    name: e.node.name,
    email: e.node.email || "customer@example.com",
    displayName: e.node.displayName || e.node.name,
    createdAt: e.node.createdAt,
    lineItems: (e.node.lineItems?.edges || []).map((li: any) => ({
      id: String(li.node.id).replace("gid://shopify/LineItem/", ""),
      title: li.node.title,
      quantity: li.node.quantity,
      sku: li.node.sku || "",
      variantId: li.node.variant?.id || `gid://shopify/ProductVariant/1`,
      price: li.node.originalUnitPriceSet?.shopMoney?.amount || "0",
    })),
  }));
}

// statuses to spread across the seeded returns (for screenshot variety)
const SEED_STATUSES = ["PENDING", "PENDING", "APPROVED", "APPROVED", "DENIED", "REFUNDED", "REFUNDED", "SHIPPED", "APPROVED", "PENDING"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || session.accessToken;
  const orders = token ? await fetchOrders(shop, token) : [];
  return json({ shop, orders, existing: await prisma.returnRequest.count({ where: { shop } }) });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const sess = await prisma.session.findFirst({ where: { shop, isOnline: false } });
  const token = sess?.accessToken || session.accessToken;
  const orders = token ? await fetchOrders(shop, token) : [];

  let created = 0;
  for (let i = 0; i < Math.min(SEED_STATUSES.length, orders.length); i++) {
    const o = orders[i];
    const st = SEED_STATUSES[i];
    // Reuse the order id basis but make each seeded return reference a unique order
    const items = o.lineItems.slice(0, Math.min(3, o.lineItems.length)).map((li: any) => ({
      id: li.id, variantId: li.variantId, title: li.title,
      quantity: li.quantity, price: li.price, sku: li.sku,
    }));
    if (items.length === 0) continue;
    const customerName = (o.email || o.displayName).split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    await prisma.returnRequest.create({
      data: {
        shop, orderId: `${o.id}-${i}`, orderName: o.name, customerEmail: o.email, customerName, items,
        reason: st === "DENIED" ? "changed_mind" : "sizing_issue",
        status: st as any,
        decidedBy: ["APPROVED", "REFUNDED", "SHIPPED"].includes(st) ? "auto" : st === "DENIED" ? "admin" : null,
        decidedAt: st !== "PENDING" ? new Date() : null,
        createdAt: new Date(new Date(o.createdAt).getTime() + 1000 * 60 * 30 * (i + 1)),
        refundAmount: st === "REFUNDED" ? items.reduce((s: number, it: any) => s + parseFloat(it.price) * it.quantity, 0) : null,
      },
    });
    created++;
  }
  return json({ ok: true, shop, created });
};

export default function DevSeed() {
  const { shop, orders, existing } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const seeded = fetcher.data?.ok;
  const total = (orders as any[]).length;

  return (
    <Page>
      <TitleBar title="Dev Seed (screenshots)" />
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingLg" as="h2" fontWeight="bold">Seed Demo Returns</Text>
              <Button variant="primary" onClick={() => fetcher.submit(null, { method: "post" })}>Seed demo data</Button>
            </InlineStack>
            <Text variant="bodyMd" as="p">
              Store: <b>{shop}</b> · Orders found: <b>{total}</b> · Existing returns in DB: <b>{existing}</b>
            </Text>
            {total === 0 && <Banner tone="warning"><p>No orders found in this store. Create test orders in Shopify first.</p></Banner>}
            {seeded && fetcher.data?.ok && <Banner tone="success"><p>Seeded {fetcher.data.created} returns! Refresh Dashboard/Returns/Analytics to see them.</p></Banner>}
            <Text as="h3" variant="headingMd">Orders visible:</Text>
            {orders.length === 0 ? (
              <Text as="p" tone="subdued">None</Text>
            ) : (
              (orders as any[]).map((o) => <Text key={o.id} as="p" tone="subdued">• {o.name} — {o.email} ({o.lineItems?.length} items)</Text>)
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}