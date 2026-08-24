import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  BlockStack,
  Text,
  Banner,
  IndexTable,
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

// ─────────────────────────────────────────────────────────────
// PremiumKPI — stat card: label on top, ICON|VALUE on same row.
// White card, soft shadow, gradient-ring icon chip.
// ─────────────────────────────────────────────────────────────
function PremiumKPI({ label, value, icon, gradient, tone }: {
  label: string;
  value: string | number;
  icon: string;
  gradient: string;
  tone?: "default" | "success" | "warning" | "critical";
}) {
  const valueColor =
    tone === "success" ? "#008060"
    : tone === "warning" ? "#B45309"
    : tone === "critical" ? "#DC2626"
    : "#1A202C";
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 20,
      boxShadow: "0 4px 12px rgba(0,0,0,.03)", border: "1px solid #EDF2F7",
    }}>
      <BlockStack gap="200">
        <Text variant="bodySm" as="span" tone="subdued">{label}</Text>
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
          <div style={{ color: valueColor, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
            {value}
          </div>
        </InlineStack>
      </BlockStack>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StatusPill — rounded pill badge with soft pastel fill + dark text.
// ─────────────────────────────────────────────────────────────
const PILL_STYLES: Record<string, { bg: string; fg: string }> = {
  PENDING:  { bg: "#FDE8D0", fg: "#793B10" },
  APPROVED: { bg: "#E0F2FE", fg: "#075985" },
  AUTOAPPROVED: { bg: "#EDE9FE", fg: "#5B21B6" },
  DENIED:   { bg: "#FEE2E2", fg: "#991B1B" },
  REFUNDED: { bg: "#D1FAE5", fg: "#065F46" },
  SHIPPED:  { bg: "#E0E7FF", fg: "#3730A3" },
  EXCHANGE: { bg: "#E0F2FE", fg: "#075985" },
  CLOSED:   { bg: "#E2E8F0", fg: "#334155" },
};
function StatusPill({ status, auto }: { status: string; auto?: boolean }) {
  const style = auto ? PILL_STYLES.AUTOAPPROVED : (PILL_STYLES[status] || { bg: "#E2E8F0", fg: "#334155" });
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 999,
      background: style.bg, color: style.fg, fontSize: 12, fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {auto ? "Auto-Approved" : (PILL_LABELS[status] || status)}
    </span>
  );
}
const PILL_LABELS: Record<string, string> = {
  PENDING: "Pending", APPROVED: "Approved", DENIED: "Denied",
  REFUNDED: "Refunded", SHIPPED: "Shipped", EXCHANGE: "Exchange", CLOSED: "Closed",
};

// Mini bar chart (Returns Trend) — capsule bars, teal→indigo gradient
function TrendChart({ counts }: { counts: { label: string; value: number }[] }) {
  const max = Math.max(...counts.map((c) => c.value), 1);
  const colors = [
    "#2A9D8F", "#2FB3A0", "#38C7AD", "#7C3AED", "#8B5CF6", "#6D28D9",
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 90, padding: "8px 0" }}>
      {counts.map((c, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: "100%", maxWidth: 18, height: `${(c.value / max) * 100}%`,
            minHeight: c.value > 0 ? 6 : 0, borderRadius: 8,
            background: colors[i % colors.length],
          }} />
          <span style={{ fontSize: 10, color: "#718096" }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { stats, recentReturns } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  // Client-side status filter for the Recent Returns table (click a KPI card)
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filtered = activeFilter === "all"
    ? recentReturns
    : recentReturns.filter((r) => r.status === activeFilter);

  const rowMarkup = filtered.map(
    ({ id, orderName, customerName, status, decidedBy, createdAt }, index) => {
      const isAutoApproved = status === "APPROVED" && decidedBy === "auto";
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
          <IndexTable.Cell>
            <Text as="span" variant="bodyMd">{customerName || "—"}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <StatusPill status={status} auto={isAutoApproved} />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" variant="bodySm" tone="subdued">{new Date(createdAt).toLocaleDateString()}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Button size="micro" variant="primary" onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${id}`); }}>
              Edit / View
            </Button>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  // Returns Trend chart — last 7 days, ENGLISH day labels (consistent with app)
  const trendData = (() => {
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const days: { key: string; label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1],
        value: 0,
      });
    }
    recentReturns.forEach((r) => {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      const day = days.find((x) => x.key === key);
      if (day) day.value++;
    });
    return days;
  })();

  // Add "Approved Today" to the KPI filter keys
  const kpis = [
    { label: "Total Returns", value: stats.totalReturns, icon: "📦", gradient: "linear-gradient(135deg,#2A9D8F,#10B981)", filter: "all", tone: undefined as any },
    { label: "Pending Review", value: stats.pendingReturns, icon: "⏳", gradient: "linear-gradient(135deg,#B45309,#F97316)", filter: "PENDING", tone: (stats.pendingReturns > 0 ? "warning" : "default") as any },
    { label: "Approved Today", value: stats.approvedToday, icon: "✅", gradient: "linear-gradient(135deg,#3B82F6,#06B6D4)", filter: "APPROVED", tone: undefined },
    { label: "Total Refunded", value: `$${Number(stats.totalRefunded).toFixed(2)}`, icon: "💰", gradient: "linear-gradient(135deg,#10B981,#059669)", filter: "REFUNDED", tone: "success" },
  ];

  return (
    <Page title="Dashboard">
      <TitleBar title="Shopigent Returns" />
      <style>{`
        /* ── KPI grid ── 2 cards per line on mobile, 4 on desktop ── */
        .dash-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 640px) { .dash-kpi-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; } }
        /* Active-filter highlight on the clicked KPI card */
        .dash-kpi-grid .filter-active > div { outline: 2px solid #7C3AED; outline-offset: 1px; border-radius: 16px; }
        /* ── Split layout: table (left) + chart (right) ── */
        .dash-split { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 900px) { .dash-split { grid-template-columns: 1.6fr 1fr; } }
        /* ── Shared card shell + helpers ── */
        .padded-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .chart-card { background: #fff; border-radius: 16px; padding: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,.03); border: 1px solid #EDF2F7; }
        .chart-sub { font-size: 13px; color: #718096; margin: 4px 0 8px; }
      `}</style>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* ─── KPI Overview row — click a card to filter ──────── */}
            <div className="dash-kpi-grid">
              {kpis.map((k) => (
                <div
                  key={k.filter}
                  onClick={() => setActiveFilter(activeFilter === k.filter ? "all" : k.filter)}
                  style={{ cursor: "pointer" }}
                  className={activeFilter === k.filter ? "filter-active" : ""}
                >
                  <PremiumKPI label={k.label} value={k.value} icon={k.icon} gradient={k.gradient} tone={k.tone} />
                </div>
              ))}
            </div>

            {/* ─── Split: Recent Returns table + Trend chart ─────── */}
            <div className="dash-split">
              {/* Recent Returns table */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,.03)", border: "1px solid #EDF2F7" }}>
                <div className="padded-header">
                  <div>
                    <Text variant="headingMd" as="h2" fontWeight="bold">Recent Returns</Text>
                    {activeFilter !== "all" && (
                      <Text variant="bodySm" as="span" tone="subdued">Filtered: {activeFilter} — <Button variant="plain" onClick={() => setActiveFilter("all")}>Show all</Button></Text>
                    )}
                  </div>
                  <Button variant="plain" onClick={() => navigate("/returns")}>View all →</Button>
                </div>
                {filtered.length === 0 ? (
                  <Banner tone="info">
                    <p>{activeFilter === "all" ? "No returns yet. Returns will appear here when customers submit them." : `No ${activeFilter.toLowerCase()} returns right now.`}</p>
                  </Banner>
                ) : (
                  <IndexTable
                    selectable={false}
                    resourceName={{ singular: "return", plural: "returns" }}
                    itemCount={filtered.length}
                    headings={[
                      { title: "Order" },
                      { title: "Customer" },
                      { title: "Status" },
                      { title: "Date" },
                      { title: "" },
                    ]}
                  >
                    {rowMarkup}
                  </IndexTable>
                )}
              </div>

              {/* Returns Trend chart */}
              <div className="chart-card">
                <Text variant="headingMd" as="h2" fontWeight="bold">Returns Trend</Text>
                <div className="chart-sub">Last 7 days</div>
                <TrendChart counts={trendData} />
              </div>
            </div>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}