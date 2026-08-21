import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  IndexTable,
  Badge,
  Link,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";
import { ensureReturnsWebhook } from "../lib/returns-webhook.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;

  // Re-register webhooks — ensures returns/update is active (REST API, reliable)
  try {
    const wh = await ensureReturnsWebhook(shop);
    console.log(`[dashboard] returns/update webhook: ${wh.detail || "ok"}`);
  } catch (err: any) {
    console.error(`[dashboard] Webhook registration: ${err.message}`);
  }

  const totalReturns = await prisma.returnRequest.count({ where: { shop } });
  const pendingReturns = await prisma.returnRequest.count({
    where: { shop, status: "PENDING" },
  });
  const approvedToday = await prisma.returnRequest.count({
    where: {
      shop,
      status: "APPROVED",
      decidedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  const totalRefunded = await prisma.returnRequest.aggregate({
    where: { shop, status: "REFUNDED" },
    _sum: { refundAmount: true },
  });

  const recentReturns = await prisma.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return json({
    stats: {
      totalReturns,
      pendingReturns,
      approvedToday,
      totalRefunded: totalRefunded._sum.refundAmount || 0,
    },
    recentReturns,
  });
};

function statusBadge(status: string) {
  const map: Record<string, { children: string; status: "success" | "warning" | "critical" | "info" | "new" }> = {
    PENDING: { children: "Pending", status: "warning" },
    APPROVED: { children: "Approved", status: "info" },
    DENIED: { children: "Denied", status: "critical" },
    EXCHANGE: { children: "Exchange", status: "info" },
    SHIPPED: { children: "Shipped", status: "new" },
    REFUNDED: { children: "Refunded", status: "success" },
    CLOSED: { children: "Closed", status: "info" },
  };
  return map[status] || { children: status, status: "info" as const };
}

// ─────────────────────────────────────────────────────────────
// PremiumKPI — a polished stat/kpi card with a gradient icon
// accent and colored value, so the dashboard reads at a glance.
// ─────────────────────────────────────────────────────────────
function PremiumKPI({ label, value, icon, gradient, tone }: {
  label: string;
  value: string | number;
  icon: string;            // single emoji/symbol, simple & clean
  gradient: string;        // css background for the icon chip
  tone?: "default" | "success" | "warning" | "critical";
}) {
  const valueColor =
    tone === "success" ? "#008060"
    : tone === "warning" ? "#B98900"
    : tone === "critical" ? "#D72C0D"
    : "#202123";
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          {/* Gradient ring with white interior — icon stays visible */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, padding: 2,
            background: gradient, display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,.1)",
          }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: 10,
              background: "#fff", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>
              <span>{icon}</span>
            </div>
          </div>
          <Text variant="bodySm" as="span" tone="subdued">{label}</Text>
        </InlineStack>
        <div style={{ color: valueColor, fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </div>
      </BlockStack>
    </Card>
  );
}

export default function Dashboard() {
  const { stats, recentReturns } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = recentReturns.map(
    ({ id, orderName, customerName, status, decidedBy, createdAt }, index) => {
      const badge = statusBadge(status);
      // Auto-approved returns (decidedBy === "auto") get a distinct badge so
      // the merchant can immediately tell them apart from manual approvals.
      const isAutoApproved = status === "APPROVED" && decidedBy === "auto";
      const statusBadgeEl = isAutoApproved ? (
        <Badge tone="new">Auto-Approved</Badge>
      ) : (
        <Badge tone={badge.status}>{badge.children}</Badge>
      );
      return (
        <IndexTable.Row
          id={id}
          key={id}
          position={index}
          onClick={() => navigate(`/returns/${id}`)}
        >
          <IndexTable.Cell>
            <Link url={`/returns/${id}`} onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${id}`); }}>
              {orderName || "—"}
            </Link>
          </IndexTable.Cell>
          <IndexTable.Cell>{customerName || "—"}</IndexTable.Cell>
          <IndexTable.Cell>
            {statusBadgeEl}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {new Date(createdAt).toLocaleDateString()}
          </IndexTable.Cell>
          <IndexTable.Cell>
                      <InlineStack gap="200">
                        <Button size="micro" onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${id}`); }}>
                          Edit / View
                        </Button>
                      </InlineStack>
                    </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <Page title="Dashboard">
      <TitleBar title="Shopigent Returns" />
      <Layout>
        {/* ─── KPI Overview row ─────────────────────────────── */}
        <Layout.Section>
          <BlockStack gap="400">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <PremiumKPI label="Total Returns" value={stats.totalReturns} icon="📦" gradient="linear-gradient(135deg,#7C3AED,#10B981)" />
              <PremiumKPI label="Pending Review" value={stats.pendingReturns} icon="⏳" gradient="linear-gradient(135deg,#F59E0B,#F97316)" tone={stats.pendingReturns > 0 ? "warning" : "default"} />
              <PremiumKPI label="Approved Today" value={stats.approvedToday} icon="✅" gradient="linear-gradient(135deg,#3B82F6,#06B6D4)" />
              <PremiumKPI label="Total Refunded" value={`$${Number(stats.totalRefunded).toFixed(2)}`} icon="💰" gradient="linear-gradient(135deg,#10B981,#059669)" tone="success" />
            </div>
          </BlockStack>
        </Layout.Section>

        {/* ─── Recent Returns table ─────────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2" fontWeight="bold">
                  Recent Returns
                </Text>
                <Button variant="plain" onClick={() => navigate("/returns")}>View all →</Button>
              </InlineStack>
              {recentReturns.length === 0 ? (
                <Banner tone="info">
                  <p>No returns yet. Returns will appear here when customers submit them.</p>
                </Banner>
              ) : (
                <IndexTable
                  selectable={false}
                  resourceName={{ singular: "return", plural: "returns" }}
                  itemCount={recentReturns.length}
                  headings={[
                    { title: "Order" },
                    { title: "Customer" },
                    { title: "Status" },
                    { title: "Date" },
                    { title: "Actions" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}