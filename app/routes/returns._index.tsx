import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  SkeletonBodyText,
  TextField,
  IndexTable,
  Link,
  Button,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { useState, useCallback, useRef, useEffect } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

const STATUS_COLORS: Record<string, "success" | "warning" | "critical" | "info" | "new"> = {
  PENDING: "warning",
  APPROVED: "info",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "new",
  REFUNDED: "success",
  CLOSED: "info",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;

  const where: any = { shop: session.shop };
  if (status) where.status = status;

  const returns = await prisma.returnRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const counts = await prisma.returnRequest.groupBy({
    by: ["status"],
    where: { shop: session.shop },
    _count: true,
  });

  const countMap: Record<string, number> = {};
  counts.forEach((c) => { countMap[c.status] = c._count; });

  return json({ returns, counts: countMap, currentStatus: status || "all" });
};

function statusBadge(status: string) {
  return {
    children: status.charAt(0) + status.slice(1).toLowerCase(),
    tone: STATUS_COLORS[status] || "info",
  };
}

// ─────────────────────────────────────────────────────────────
// PremiumFilterCard — premium KPI-style filter card with icon.
// Clicking filters the list client-side (no page redirect).
// ─────────────────────────────────────────────────────────────
function PremiumFilterCard({ label, value, icon, gradient, active, onClickOn }: {
  label: string;
  value: string | number;
  icon: string;
  gradient: string;
  active: boolean;
  onClickOn: () => void;
}) {
  return (
    <div
      onClick={onClickOn}
      style={{
        cursor: "pointer", background: "#fff", borderRadius: 16, padding: 16,
        boxShadow: active ? "0 4px 12px rgba(124,58,237,.2)" : "0 2px 8px rgba(0,0,0,.04)",
        border: active ? "2px solid #7C3AED" : "1px solid #EDF2F7",
        transition: "all .2s",
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <Text variant="bodySm" as="span" tone="subdued">{label}</Text>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Gradient ring icon chip (white interior, icon visible) */}
        <div style={{
          width: 40, height: 40, borderRadius: 12, padding: 2, background: gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,.1)", flexShrink: 0,
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: 10, background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
          }}>
            <span>{icon}</span>
          </div>
        </div>
        {/* Matches the Dashboard KPI value styling: 22px / 700, no wrapping */}
        <div style={{
          fontSize: 22, fontWeight: 700, lineHeight: 1.15, color: "#1A202C",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StatusPill — rounded pastel status badge (matches dashboard).
// ─────────────────────────────────────────────────────────────
const PILL_STYLES: Record<string, { bg: string; fg: string }> = {
  PENDING:    { bg: "#FDE8D0", fg: "#793B10" },
  APPROVED:   { bg: "#E0F2FE", fg: "#075985" },
  AUTOAPPROVED: { bg: "#EDE9FE", fg: "#5B21B6" },
  DENIED:     { bg: "#FEE2E2", fg: "#991B1B" },
  REFUNDED:   { bg: "#D1FAE5", fg: "#065F46" },
  SHIPPED:    { bg: "#E0E7FF", fg: "#3730A3" },
  EXCHANGE:   { bg: "#E0F2FE", fg: "#075985" },
  CLOSED:     { bg: "#E2E8F0", fg: "#334155" },
};
const PILL_LABELS: Record<string, string> = {
  PENDING: "Pending", APPROVED: "Approved", DENIED: "Denied",
  REFUNDED: "Refunded", SHIPPED: "Shipped", EXCHANGE: "Exchange", CLOSED: "Closed",
};
function StatusPill({ status, auto }: { status: string; auto?: boolean }) {
  const style = auto ? PILL_STYLES.AUTOAPPROVED : (PILL_STYLES[status] || { bg: "#E2E8F0", fg: "#334155" });
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 999,
      background: style.bg, color: style.fg, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {auto ? "Auto-Approved" : (PILL_LABELS[status] || status)}
    </span>
  );
}

export default function ReturnsPage() {
  const { returns, counts } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  // Client-side status filter (click a KPI card) + search query
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.toLowerCase();
  const filteredReturns = returns.filter((r) => {
    const statusOk = activeFilter === "all" || r.status === activeFilter;
    const textOk = !q
      || (r.orderName || "").toLowerCase().includes(q)
      || (r.customerName || "").toLowerCase().includes(q);
    return statusOk && textOk;
  });

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const filteredRowMarkup = filteredReturns.map(
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
          <IndexTable.Cell>{customerName || "—"}</IndexTable.Cell>
          <IndexTable.Cell>
            <StatusPill status={status} auto={isAutoApproved} />
          </IndexTable.Cell>
          <IndexTable.Cell className="ret-col-hide-mobile">
            <Text as="span" variant="bodySm" tone="subdued">{new Date(createdAt).toLocaleDateString()}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell className="ret-col-hide-mobile">
            <InlineStack gap="100">
              <Button size="micro" onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${id}`); }}>
                Edit / View
              </Button>
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  const filterCards = [
    { label: "All", count: totalCount, key: "all", icon: "📦", gradient: "linear-gradient(135deg,#2A9D8F,#10B981)" },
    { label: "Pending", count: counts.PENDING || 0, key: "PENDING", icon: "⏳", gradient: "linear-gradient(135deg,#B45309,#F97316)" },
    { label: "Approved", count: counts.APPROVED || 0, key: "APPROVED", icon: "✅", gradient: "linear-gradient(135deg,#3B82F6,#06B6D4)" },
    { label: "Denied", count: counts.DENIED || 0, key: "DENIED", icon: "🚫", gradient: "linear-gradient(135deg,#DC2626,#EF4444)" },
    { label: "Refunded", count: counts.REFUNDED || 0, key: "REFUNDED", icon: "💰", gradient: "linear-gradient(135deg,#10B981,#059669)" },
  ];

  // ── MOBILE STACKED CARDS ──────────────────────────────────
  // On small screens (instead of a horizontally-scrolled table) each return
  // is rendered as a tappable card. Rows expand vertically: Order + Status on
  // the first line, Customer + Date below, and a full-width action button.
  const mobileCardsMarkup = filteredReturns.map((r) => {
    const isAutoApproved = r.status === "APPROVED" && r.decidedBy === "auto";
    return (
      <div
        key={r.id}
        onClick={() => navigate(`/returns/${r.id}`)}
        style={{
          background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,.04)", border: "1px solid #EDF2F7",
          cursor: "pointer", transition: "box-shadow .15s",
        }}
      >
        {/* Row 1: order + status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Link url={`/returns/${r.id}`} onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${r.id}`); }} style={{ fontWeight: 700 }}>
            {r.orderName || "—"}
          </Link>
          <StatusPill status={r.status} auto={isAutoApproved} />
        </div>
        {/* Row 2: customer + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text variant="bodySm" as="span">{r.customerName || "—"}</Text>
          <Text variant="bodySm" as="span" tone="subdued">{new Date(r.createdAt).toLocaleDateString()}</Text>
        </div>
        {/* Action button */}
        <Button size="slim" fullWidth onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${r.id}`); }}>
          Edit / View
        </Button>
      </div>
    );
  });

  return (
    <Page title="Returns">
      <style>{`
        /* Filter cards: 2/line on mobile, all 5 across on wide */
        .returns-filter-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 640px) { .returns-filter-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .returns-filter-grid { grid-template-columns: repeat(5, 1fr); } }
        /* ── MOBILE HARDENING ── */
        /* Desktop-only vs mobile-only toggling (ret-dt-only = table, ret-mo-only = cards) */
        .ret-dt-only { display: block; }
        .ret-mo-only { display: none; }
        @media (max-width: 639px) {
          /* Filter cards: keep 2/line but shrink padding so nothing clips */
          .returns-filter-grid { gap: 8px; }
          /* On mobile show stacked cards, hide the desktop table */
          .ret-dt-only { display: none; }
          .ret-mo-only { display: block; }
          .returns-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; }
          .ret-col-hide-mobile { display: none; }
          .Polaris-IndexTable__TableHeaderCell:nth-child(4),
          .Polaris-IndexTable__TableHeaderCell:nth-child(5) { display: none; }
          /* Side padding so filter cards don't touch screen edges on mobile */
          .returns-page-content { padding-left: 10px; padding-right: 10px; }
        }
      `}</style>
      <Layout>
        <Layout.Section>
          <div className="returns-page-content">
          <BlockStack gap="400">
            {/* ─── Premium KPI filter cards (client-side filter, icons) ── */}
            <div className="returns-filter-grid">
              {filterCards.map((c) => (
                <PremiumFilterCard
                  key={c.key}
                  label={c.label}
                  value={c.count}
                  icon={c.icon}
                  gradient={c.gradient}
                  active={activeFilter === c.key}
                  onClickOn={() => setActiveFilter(activeFilter === c.key ? "all" : c.key)}
                />
              ))}
            </div>

            {/* Search bar */}
            {returns.length > 0 && (
              <TextField
                label="Search returns"
                placeholder="Search by order name or customer..."
                value={searchQuery}
                onChange={setSearchQuery}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
              />
            )}

            {/* Returns list — table on desktop, stacked cards on mobile */}
            {isLoading ? (
              <Card>
                <div style={{ padding: 20 }}>
                  <SkeletonBodyText lines={5} />
                </div>
              </Card>
            ) : filteredReturns.length === 0 ? (
              <Card>
                <EmptyState
                  heading={searchQuery ? "No matching returns" : activeFilter !== "all" ? `No ${activeFilter.toLowerCase()} returns` : "No returns yet"}
                  image=""
                >
                  <p>{searchQuery ? "Try a different search term." : activeFilter !== "all" ? `No ${activeFilter.toLowerCase()} returns match this filter.` : "Returns will appear here when customers submit them."}</p>
                </EmptyState>
              </Card>
            ) : (
              <>
                {/* Desktop table (hidden on mobile) */}
                <div className="ret-dt-only">
                  <Card>
                    <div className="returns-table-wrap">
                      <IndexTable
                        selectable={false}
                        itemCount={filteredReturns.length}
                        headings={[
                          { title: "Order" },
                          { title: "Customer" },
                          { title: "Status" },
                          { title: "Date" },
                          { title: "Actions" },
                        ]}
                      >
                        {filteredRowMarkup}
                      </IndexTable>
                    </div>
                  </Card>
                </div>
                {/* Mobile stacked cards (hidden on desktop) */}
                <div className="ret-mo-only">
                  {mobileCardsMarkup}
                </div>
              </>
            )}
          </BlockStack>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}