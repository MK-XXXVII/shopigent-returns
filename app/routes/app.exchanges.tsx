import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  IndexTable,
  Badge,
  Button,
  InlineStack,
  EmptyState,
  useIndexResourceState,
  Link,
  Modal,
  TextField,
  Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../lib/db.server";
import { createDraftOrder } from "../lib/shopify-admin.server";

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
  const { session } = await authenticate.admin(request);

  const exchanges = await prisma.returnRequest.findMany({
    where: {
      shop: session.shop,
      status: { in: ["PENDING", "EXCHANGE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const counts = await prisma.returnRequest.groupBy({
    by: ["status"],
    where: { shop: session.shop, status: { in: ["PENDING", "EXCHANGE"] } },
    _count: true,
  });

  const countMap: Record<string, number> = {};
  counts.forEach((c) => { countMap[c.status] = c._count; });

  return json({ exchanges, counts: countMap });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "exchange") {
    const returnId = String(formData.get("returnId") || "");
    const variantId = String(formData.get("variantId") || "");
    const quantity = parseInt(String(formData.get("quantity") || "1"), 10);

    const returnReq = await prisma.returnRequest.findFirst({
      where: { id: returnId, shop: session.shop },
    });
    if (!returnReq) {
      return json({ ok: false, error: "Return not found" });
    }
    if (returnReq.status !== "PENDING" && returnReq.status !== "EXCHANGE") {
      return json({ ok: false, error: `Cannot exchange return in status ${returnReq.status}` });
    }

    const shopSession = await prisma.session.findFirst({
      where: { shop: session.shop, isOnline: false },
    });
    if (!shopSession?.accessToken) {
      return json({ ok: false, error: "No access token available" });
    }

    const draftResult = await createDraftOrder(
      session.shop,
      shopSession.accessToken,
      [{ variantId, quantity }],
      returnReq.customerEmail || undefined,
      `Exchange for return ${returnReq.id}`
    );

    if (draftResult.error || !draftResult.draftOrderId) {
      return json({ ok: false, error: draftResult.error || "Failed to create draft order" });
    }

    await prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        status: "EXCHANGE",
        decidedBy: "staff",
        decidedAt: new Date(),
        labels: [{
          type: "exchange_order",
          status: "created",
          draftOrderId: draftResult.draftOrderId,
          replacementVariantId: variantId,
          replacementQuantity: quantity,
          createdAt: new Date().toISOString(),
        }],
      },
    });

    await prisma.decisionLog.create({
      data: {
        returnId,
        actor: "staff",
        action: "exchange",
        details: { draftOrderId: draftResult.draftOrderId, variantId, quantity },
      },
    });

    return json({ ok: true, draftOrderId: draftResult.draftOrderId });
  }

  return json({ ok: false, error: "Unknown intent" });
};

function statusBadge(status: string) {
  return {
    children: status.charAt(0) + status.slice(1).toLowerCase(),
    tone: STATUS_COLORS[status] || "info",
  };
}

export default function ExchangesPage() {
  const { exchanges, counts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const resourceName = { singular: "exchange", plural: "exchanges" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(exchanges);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const pendingCount = counts.PENDING || 0;
  const exchangeCount = counts.EXCHANGE || 0;

  const handleExchangeSubmit = (returnId: string) => {
    if (!variantId.trim()) return;
    const formData = new FormData();
    formData.set("intent", "exchange");
    formData.set("returnId", returnId);
    formData.set("variantId", variantId.trim());
    formData.set("quantity", quantity);
    fetcher.submit(formData, { method: "POST" });
    setActiveModal(null);
    setVariantId("");
    setQuantity("1");
  };

  const rowMarkup = exchanges.map(
    ({ id, orderName, customerName, status, createdAt, items }, index) => {
      const badge = statusBadge(status);
      return (
        <IndexTable.Row
          id={id}
          key={id}
          selected={selectedResources.includes(id)}
          position={index}
        >
          <IndexTable.Cell>
            <Link url={`/returns/${id}`}>
              {orderName || "—"}
            </Link>
          </IndexTable.Cell>
          <IndexTable.Cell>{customerName || "—"}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={badge.tone}>{badge.children}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {(items as any[]).length} item{(items as any[]).length !== 1 ? "s" : ""}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {new Date(createdAt).toLocaleDateString()}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200">
              {status === "PENDING" && (
                <Button
                  size="slim"
                  variant="primary"
                  onClick={() => {
                    setActiveModal(id);
                    setVariantId("");
                    setQuantity("1");
                  }}
                >
                  Exchange
                </Button>
              )}
              {status === "EXCHANGE" && (
                <Badge tone="info">Draft created</Badge>
              )}
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <Page title="Exchanges">
      <TitleBar title="Exchanges" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                { label: "Pending Exchange", count: pendingCount, key: "PENDING", color: "#ecc134" },
                { label: "Exchanges in Progress", count: exchangeCount, key: "EXCHANGE", color: "#47c1bf" },
              ].map(({ label, count, key, color }) => (
                <Card key={key}>
                  <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 8 }}>
                    <Text variant="headingXl" as="p" fontWeight="bold">{count}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">{label}</Text>
                  </div>
                </Card>
              ))}
            </div>

            {/* Success/error banner */}
            {fetcher.data?.ok === true && (
              <Banner tone="success">
                <Text as="p" variant="bodyMd">
                  Exchange draft order created: {(fetcher.data as any).draftOrderId}
                </Text>
              </Banner>
            )}
            {fetcher.data?.ok === false && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">Exchange failed: {(fetcher.data as any).error}</Text>
              </Banner>
            )}

            {/* Exchanges table */}
            <Card>
              {exchanges.length === 0 ? (
                <EmptyState heading="No exchanges pending" image="">
                  <p>Exchange requests from customers using the return portal will appear here.</p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={exchanges.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Order" },
                    { title: "Customer" },
                    { title: "Status" },
                    { title: "Items" },
                    { title: "Date" },
                    { title: "Action" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Exchange modal */}
      {activeModal && (
        <Modal
          open={!!activeModal && fetcher.state === "idle"}
          onClose={() => setActiveModal(null)}
          title="Create Exchange"
          primaryAction={{
            content: "Create Exchange Order",
            onAction: () => handleExchangeSubmit(activeModal),
            disabled: !variantId.trim(),
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setActiveModal(null) },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label="Replacement Variant GID"
                value={variantId}
                onChange={setVariantId}
                placeholder="gid://shopify/ProductVariant/123456789"
                autoComplete="off"
                helpText="The Shopify variant GID of the replacement item"
              />
              <Select
                label="Quantity"
                value={quantity}
                onChange={setQuantity}
                options={[
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                  { label: "4", value: "4" },
                  { label: "5", value: "5" },
                ]}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}