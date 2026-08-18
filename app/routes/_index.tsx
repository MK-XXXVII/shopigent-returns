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

export default function Dashboard() {
  const { stats, recentReturns } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = recentReturns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => {
      const badge = statusBadge(status);
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
            <Badge tone={badge.status}>{badge.children}</Badge>
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
        <Layout.Section>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Overview
            </Text>
            <Layout>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingXl" as="p" fontWeight="bold">
                      {stats.totalReturns}
                    </Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      Total Returns
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingXl" as="p" fontWeight="bold" tone="critical">
                      {stats.pendingReturns}
                    </Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      Pending Review
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingXl" as="p" fontWeight="bold" tone="success">
                      ${Number(stats.totalRefunded).toFixed(2)}
                    </Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      Total Refunded
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">
                Recent Returns
              </Text>
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