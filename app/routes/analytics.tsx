import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Badge,
  List,
} from "@shopify/polaris";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;

  // Basic stats
  const totalReturns = await prisma.returnRequest.count({ where: { shop } });
  const statusCounts = await prisma.returnRequest.groupBy({
    by: ["status"],
    where: { shop },
    _count: true,
  });
  const statusMap: Record<string, number> = {};
  statusCounts.forEach((s) => { statusMap[s.status] = s._count; });

  // Total refunded amount
  const refundAgg = await prisma.returnRequest.aggregate({
    where: { shop, status: "REFUNDED" },
    _sum: { refundAmount: true },
  });
  const totalRefunded = refundAgg._sum.refundAmount || 0;

  // Auto-approved (decidedBy = agent)
  const autoApproved = await prisma.returnRequest.count({
    where: { shop, decidedBy: "agent" },
  });

  // Average resolution time (for decided returns)
  const decidedReturns = await prisma.returnRequest.findMany({
    where: { shop, decidedAt: { not: null } },
    select: { createdAt: true, decidedAt: true },
  });
  let avgResolutionHours = 0;
  if (decidedReturns.length > 0) {
    const totalHours = decidedReturns.reduce((sum, r) => {
      const diff = (new Date(r.decidedAt!).getTime() - new Date(r.createdAt!).getTime()) / (1000 * 60 * 60);
      return sum + diff;
    }, 0);
    avgResolutionHours = Math.round(totalHours / decidedReturns.length);
  }

  // Returns by day (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentReturns = await prisma.returnRequest.findMany({
    where: { shop, createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, status: true, refundAmount: true },
  });

  // Group by day
  const dailyCounts: Record<string, { total: number; approved: number; refunded: number; amount: number }> = {};
  recentReturns.forEach((r) => {
    const day = new Date(r.createdAt).toISOString().slice(0, 10);
    if (!dailyCounts[day]) dailyCounts[day] = { total: 0, approved: 0, refunded: 0, amount: 0 };
    dailyCounts[day].total++;
    if (r.status === "APPROVED" || r.status === "REFUNDED") dailyCounts[day].approved++;
    if (r.status === "REFUNDED") {
      dailyCounts[day].refunded++;
      dailyCounts[day].amount += parseFloat(String(r.refundAmount || 0));
    }
  });
  const dailyData = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);

  // Fraud signals
  const fraudCount = await prisma.fraudSignal.count({
    where: { return: { shop } },
  });
  const highRiskFraud = await prisma.fraudSignal.count({
    where: { return: { shop }, score: { gte: 0.5 } },
  });

  // Top return reasons
  const allReturns = await prisma.returnRequest.findMany({
    where: { shop, reason: { not: null } },
    select: { reason: true },
  });
  const reasonCounts: Record<string, number> = {};
  allReturns.forEach((r) => {
    const reason = r.reason?.toLowerCase().trim() || "other";
    // Normalize common reasons
    const key = reason.includes("fit") || reason.includes("size") ? "Sizing issue"
      : reason.includes("defect") || reason.includes("broken") || reason.includes("damage") ? "Defective"
      : reason.includes("color") || reason.includes("photo") || reason.includes("look") ? "Not as described"
      : reason.includes("change") || reason.includes("mind") ? "Changed mind"
      : reason.includes("quality") ? "Quality issue"
      : reason.includes("duplicate") ? "Duplicate order"
      : reason.includes("wrong") ? "Wrong item sent"
      : "Other";
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Top returned products
  const items = allReturns.length > 0 ? await prisma.returnRequest.findMany({
    where: { shop },
    select: { items: true },
  }) : [];
  const productCounts: Record<string, number> = {};
  const productRevenue: Record<string, number> = {};
  items.forEach((r) => {
    const productItems = r.items as any[];
    productItems.forEach((item: any) => {
      const title = item.title || "Unknown";
      productCounts[title] = (productCounts[title] || 0) + (item.quantity || 1);
      productRevenue[title] = (productRevenue[title] || 0) + parseFloat(item.price || "0") * (item.quantity || 1);
    });
  });
  const topProducts = Object.entries(productCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, revenue: productRevenue[name] || 0 }));

  return json({
    stats: {
      totalReturns,
      pending: statusMap.PENDING || 0,
      approved: statusMap.APPROVED || 0,
      denied: statusMap.DENIED || 0,
      refunded: statusMap.REFUNDED || 0,
      exchange: statusMap.EXCHANGE || 0,
      totalRefunded: Number(totalRefunded),
      autoApproved,
      autoRate: totalReturns > 0 ? Math.round((autoApproved / totalReturns) * 100) : 0,
      avgResolutionHours,
      fraudCount,
      highRiskFraud,
    },
    dailyData,
    topReasons: topReasons.map(([reason, count]) => ({ reason, count })),
    topProducts,
  });
};

function StatCard({ label, value, tone, prefix, suffix }: {
  label: string; value: string | number; tone?: string; prefix?: string; suffix?: string;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" as="span" tone="subdued">{label}</Text>
        <Text variant="headingXl" as="p" fontWeight="bold" tone={tone as any}>
          {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </Text>
      </BlockStack>
    </Card>
  );
}

function MiniBar({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <InlineStack align="space-between">
        <Text variant="bodySm" as="span">{label}</Text>
        <Text variant="bodySm" as="span" fontWeight="bold">{value}</Text>
      </InlineStack>
      <div style={{
        height: 8, background: "#e0e0e0", borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color || "#5c6ac4", borderRadius: 4,
          transition: "width 0.3s",
        }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { stats, dailyData, topReasons, topProducts } = useLoaderData<typeof loader>();

  const maxDaily = Math.max(...dailyData.map(d => d[1].total), 1);

  return (
    <Page title="Analytics" subtitle="Return performance overview">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Top stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <StatCard label="Total Returns" value={stats.totalReturns} />
              <StatCard label="Pending" value={stats.pending} tone="warning" />
              <StatCard label="Approved" value={stats.approved} tone="success" />
              <StatCard label="Denied" value={stats.denied} tone="critical" />
              <StatCard label="Refunded" value={stats.refunded} />
              <StatCard label="Total Refunded" value={stats.totalRefunded} prefix="$" />
            </div>

            {/* Auto-resolution rate */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <StatCard label="Auto-Resolution Rate" value={stats.autoRate} suffix="%" tone={stats.autoRate > 50 ? "success" : "warning"} />
              <StatCard label="Avg Resolution Time" value={stats.avgResolutionHours} suffix="h" />
              <StatCard label="Fraud Signals Detected" value={stats.fraudCount} tone={stats.fraudCount > 0 ? "warning" : undefined} />
              <StatCard label="High Risk Alerts" value={stats.highRiskFraud} tone={stats.highRiskFraud > 0 ? "critical" : undefined} />
            </div>

            {/* Daily trend chart */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2" fontWeight="bold">Returns Trend (Last 14 Days)</Text>
                {dailyData.length === 0 ? (
                  <Text variant="bodyMd" as="p" tone="subdued">No data for the last 14 days.</Text>
                ) : (
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120, padding: "8px 0" }}>
                    {dailyData.map(([day, data]) => (
                      <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                        <div style={{
                          width: "100%", maxWidth: 40,
                          height: `${(data.total / maxDaily) * 100}%`,
                          background: "#5c6ac4",
                          borderRadius: "4px 4px 0 0",
                          minHeight: data.total > 0 ? 4 : 0,
                          position: "relative",
                        }}>
                          {data.total > 0 && (
                            <Text variant="bodyXs" as="span" style={{
                              position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                              fontSize: 10,
                            }}>
                              {data.total}
                            </Text>
                          )}
                        </div>
                        <Text variant="bodyXs" as="span" tone="subdued" style={{ fontSize: 9, marginTop: 4 }}>
                          {day.slice(5)}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </BlockStack>
            </Card>

            {/* Two column layout for reasons + products */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Top return reasons */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2" fontWeight="bold">Top Return Reasons</Text>
                  {topReasons.length === 0 ? (
                    <Text variant="bodyMd" as="p" tone="subdued">No data yet.</Text>
                  ) : (
                    topReasons.map(({ reason, count }) => (
                      <MiniBar
                        key={reason}
                        label={reason}
                        value={count}
                        max={topReasons[0]?.count || 1}
                        color="#ecc134"
                      />
                    ))
                  )}
                </BlockStack>
              </Card>

              {/* Top returned products */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2" fontWeight="bold">Most Returned Products</Text>
                  {topProducts.length === 0 ? (
                    <Text variant="bodyMd" as="p" tone="subdued">No data yet.</Text>
                  ) : (
                    topProducts.map(({ name, count, revenue }) => (
                      <div key={name}>
                        <InlineStack align="space-between">
                          <Text variant="bodySm" as="span">{name}</Text>
                          <Text variant="bodySm" as="span" fontWeight="bold">x{count}</Text>
                        </InlineStack>
                        <Text variant="bodyXs" as="p" tone="subdued">
                          ${revenue.toFixed(2)} returned value
                        </Text>
                      </div>
                    ))
                  )}
                </BlockStack>
              </Card>
            </div>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}