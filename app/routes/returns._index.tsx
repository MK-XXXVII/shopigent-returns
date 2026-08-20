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
  Badge,
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

export default function ReturnsPage() {
  const { returns, counts, currentStatus } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.toLowerCase();
  const filteredReturns = q
    ? returns.filter((r) => (r.orderName || "").toLowerCase().includes(q) || (r.customerName || "").toLowerCase().includes(q))
    : returns;

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const filteredRowMarkup = filteredReturns.map(
    ({ id, orderName, customerName, status, decidedBy, createdAt }, index) => {
      const badge = statusBadge(status);
      // Auto-approved returns (decidedBy === "auto") get a distinct badge so
      // the merchant can immediately tell them apart from manual approvals.
      const isAutoApproved = status === "APPROVED" && decidedBy === "auto";
      const statusBadgeEl = isAutoApproved ? (
        <Badge tone="new">Auto-Approved</Badge>
      ) : (
        <Badge tone={badge.tone}>{badge.children}</Badge>
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

  return (
    <Page title="Returns">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              {[
                { label: "All", count: totalCount, key: "all", color: "#5c6ac4" },
                { label: "Pending", count: counts.PENDING || 0, key: "PENDING", color: "#ecc134" },
                { label: "Approved", count: counts.APPROVED || 0, key: "APPROVED", color: "#50b83c" },
                { label: "Denied", count: counts.DENIED || 0, key: "DENIED", color: "#de3617" },
                { label: "Refunded", count: counts.REFUNDED || 0, key: "REFUNDED", color: "#47c1bf" },
              ].map(({ label, count, key, color }) => (
                <Card key={key}>
                  <div
                    style={{
                      cursor: "pointer",
                      borderLeft: `3px solid ${color}`,
                      paddingLeft: 8,
                      opacity: currentStatus === key ? 1 : 0.7,
                    }}
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search);
                      if (key === "all") params.delete("status");
                      else params.set("status", key);
                      navigate(`/returns?${params.toString()}`, { replace: true });
                    }}
                  >
                    <Text variant="headingXl" as="p" fontWeight="bold">
                      {count}
                    </Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {label}
                    </Text>
                  </div>
                </Card>
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

                        {/* Returns table */}
                        <Card>
                          {isLoading ? (
                            <div style={{ padding: 20 }}>
                              <SkeletonBodyText lines={5} />
                            </div>
                          ) : filteredReturns.length === 0 ? (
                            <EmptyState
                              heading={searchQuery ? "No matching returns" : "No returns yet"}
                              image=""
                            >
                              <p>{searchQuery ? "Try a different search term." : "Returns will appear here when customers submit them."}</p>
                            </EmptyState>
                          ) : (
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
                          )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}