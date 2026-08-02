import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  Button,
  List,
  Tag,
} from "@shopify/polaris";
import shopify from "../shopify.server";
import prisma from "../lib/db.server";

const STATUS_COLORS: Record<string, "success" | "warning" | "critical" | "info" | "new"> = {
  PENDING: "warning", APPROVED: "success", DENIED: "critical",
  EXCHANGE: "info", SHIPPED: "info", REFUNDED: "success", CLOSED: "new",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const returnReq = await prisma.returnRequest.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      fraudSignals: true,
      decisionLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!returnReq) throw new Response("Not found", { status: 404 });

  return json({ return: returnReq });
};

export default function ReturnDetailPage() {
  const { return: r } = useLoaderData<typeof loader>();
  const items = r.items as any[];
  const logs = r.decisionLogs;

  return (
    <Page
      title={`Return ${r.orderName || r.id.slice(0, 8)}`}
      backAction={{ url: "/returns" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Status + Actions */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2" fontWeight="bold">
                      Status
                    </Text>
                    <Badge tone={STATUS_COLORS[r.status] || "info"}>
                      {r.status}
                    </Badge>
                  </BlockStack>
                  {r.status === "PENDING" && (
                    <InlineStack gap="200">
                      <Button tone="critical">Deny</Button>
                      <Button variant="primary" tone="success">Approve</Button>
                    </InlineStack>
                  )}
                </InlineStack>
                {r.customerName && (
                  <Text variant="bodyMd" as="p">
                    <strong>Customer:</strong> {r.customerName} {r.customerEmail && `(${r.customerEmail})`}
                  </Text>
                )}
                {r.reason && (
                  <Text variant="bodyMd" as="p">
                    <strong>Reason:</strong> {r.reason}
                  </Text>
                )}
                {r.notes && (
                  <Text variant="bodyMd" as="p">
                    <strong>Notes:</strong> {r.notes}
                  </Text>
                )}
                <Text variant="bodySm" as="p" tone="subdued">
                  Created: {new Date(r.createdAt).toLocaleString()}
                </Text>
              </BlockStack>
            </Card>

            {/* Items */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2" fontWeight="bold">
                  Items ({items.length})
                </Text>
                {items.map((item: any, i: number) => (
                  <BlockStack key={i} gap="100">
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="span" fontWeight="bold">
                        {item.title}
                      </Text>
                      <Text variant="bodyMd" as="span">
                        x{item.quantity} {item.price && `$${item.price}`}
                      </Text>
                    </InlineStack>
                    {item.sku && <Tag>{item.sku}</Tag>}
                    {item.reason && (
                      <Text variant="bodySm" as="p" tone="subdued">
                        Reason: {item.reason}
                      </Text>
                    )}
                  </BlockStack>
                ))}
              </BlockStack>
            </Card>

            {/* Fraud Signals */}
            {r.fraudSignals.length > 0 && (
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    Fraud Signals
                  </Text>
                  {r.fraudSignals.map((s) => (
                    <InlineStack key={s.id} gap="200">
                      <Badge tone={s.score > 0.5 ? "critical" : "warning"}>
                        {(s.score * 100).toFixed(0)}%
                      </Badge>
                      <Text variant="bodyMd" as="span">{s.signal}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            )}

            {/* Decision Log */}
            {logs.length > 0 && (
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    Activity Log
                  </Text>
                  {logs.map((log) => (
                    <BlockStack key={log.id} gap="100">
                      <InlineStack gap="200">
                        <Text variant="bodySm" as="span" fontWeight="bold">
                          {log.actor}
                        </Text>
                        <Tag>{log.action}</Tag>
                        <Text variant="bodySm" as="span" tone="subdued">
                          {new Date(log.createdAt).toLocaleString()}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  ))}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}