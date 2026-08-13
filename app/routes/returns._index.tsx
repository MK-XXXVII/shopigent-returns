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
  useIndexResourceState,
  Link,
  EmptyState,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { useState } from "react";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

const STATUS_COLORS: Record<string, "success" | "warning" | "critical" | "info" | "new"> = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new",
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

  const resourceName = { singular: "return", plural: "returns" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(returns);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const rowMarkup = returns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => {
      const badge = statusBadge(status);
      const isPending = status === "PENDING";
      return (
        <IndexTable.Row
          id={id}
          key={id}
          selected={selectedResources.includes(id)}
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
            <Badge tone={badge.tone}>{badge.children}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {new Date(createdAt).toLocaleDateString()}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="100">
              <Button size="micro" onClick={(e: any) => { e.stopPropagation(); navigate(`/returns/${id}`); }}>
                View
              </Button>
              {isPending && (
                <>
                  <Button size="micro" variant="primary" tone="success" onClick={(e: any) => {
                    e.stopPropagation();
                    navigate(`/returns/${id}`);
                  }}>
                    Approve
                  </Button>
                  <Button size="micro" tone="critical" onClick={(e: any) => {
                    e.stopPropagation();
                    navigate(`/returns/${id}`);
                  }}>
                    Deny
                  </Button>
                </>
              )}
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
                      window.location.search = params.toString();
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

            {/* Returns table */}
            <Card>
              {returns.length === 0 ? (
                <EmptyState
                  heading="No returns yet"
                  image=""
                >
                  <p>Returns will appear here when customers submit them or when orders are fulfilled.</p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={returns.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
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
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}