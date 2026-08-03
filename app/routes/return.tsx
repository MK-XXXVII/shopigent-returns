import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Card, BlockStack, Text, TextField, Button, Banner, Checkbox, InlineStack } from "@shopify/polaris";
import { useState } from "react";
import prisma from "../lib/db.server";

// Customer Portal — public-facing, no Shopify auth required
// Uses the store's stored offline access token to query the Admin API

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "bundlebuzz-store.myshopify.com";
  return json({ shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const _action = formData.get("_action") as string;
  const shop = formData.get("shop") as string || "bundlebuzz-store.myshopify.com";
  const email = formData.get("email") as string;
  const orderName = formData.get("orderName") as string;

  // Get the store's offline session to make Shopify API calls
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
  });

  if (!session?.accessToken) {
    return json({ error: "Store not connected. Please try again later." }, { status: 400 });
  }

  if (_action === "lookup") {
    // Look up orders by customer email using Admin API
    const query = `{
      customers(first: 1, query: "${email}") {
        edges {
          node {
            id
            firstName
            lastName
            orders(first: 20, sortKey: CREATED_AT, reverse: true) {
              edges {
                node {
                  id
                  name
                  createdAt
                  totalPriceSet {
                    shopMoney { amount currencyCode }
                  }
                  fulfillments(first: 5) { edges { node { status } } }
                  lineItems(first: 20) {
                    edges {
                      node {
                        id
                        title
                        quantity
                        variant { id sku }
                        originalUnitPriceSet { shopMoney { amount } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;

    try {
      // Use the stored session to make the API call
      const response = await fetch(
        `https://${shop}/admin/api/2024-10/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken,
          },
          body: JSON.stringify({ query }),
        }
      );

      const data = await response.json();
      const customer = data?.data?.customers?.edges?.[0]?.node;

      if (!customer) {
        return json({ error: "No customer found with this email." });
      }

      const orders = customer.orders.edges.map((e: any) => {
        const node = e.node;
        const items = node.lineItems.edges.map((li: any) => ({
          id: li.node.id,
          title: li.node.title,
          quantity: li.node.quantity,
          sku: li.node.variant?.sku || "",
          price: li.node.originalUnitPriceSet?.shopMoney?.amount || "0",
          variantId: li.node.variant?.id || "",
        }));
        return {
          id: node.id,
          name: node.name,
          createdAt: node.createdAt,
          total: node.totalPriceSet?.shopMoney?.amount || "0",
          currency: node.totalPriceSet?.shopMoney?.currencyCode || "USD",
          items,
          fulfilled: node.fulfillments?.edges?.length > 0,
        };
      });

      return json({ customer: { name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() }, orders });
    } catch (err: any) {
      return json({ error: `Failed to look up orders: ${err.message}` });
    }
  }

  if (_action === "submit_return") {
    const orderId = formData.get("orderId") as string;
    const customerName = formData.get("customerName") as string;
    const customerEmail = formData.get("customerEmail") as string;
    const reason = formData.get("reason") as string;
    const selectedItems = JSON.parse(formData.get("selectedItems") as string || "[]");
    const orderName2 = formData.get("orderName2") as string;

    if (!orderId || selectedItems.length === 0) {
      return json({ error: "Please select at least one item to return." });
    }

    await prisma.returnRequest.create({
      data: {
        shop,
        orderId,
        orderName: orderName2,
        customerEmail,
        customerName,
        items: selectedItems,
        reason,
        status: "PENDING",
      },
    });

    return json({ success: true, message: "Return request submitted! We'll review it shortly." });
  }

  return json({ error: "Invalid action" });
};

export default function ReturnPortal() {
  const { shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  const data = fetcher.data;
  const isLookup = fetcher.state === "submitting" && fetcher.formData?.get("_action") === "lookup";

  const orders = data?.orders || [];
  const customer = data?.customer;
  const error = data?.error;
  const success = data?.success;

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // Reset when looking up
  const handleLookup = () => {
    setSelectedOrder(null);
    setSelectedItems([]);
    setReason("");
  };

  if (success) {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
        <Card>
          <BlockStack gap="400" align="center">
            <Text variant="headingXl" as="h1" alignment="center" tone="success">
              ✅ Return Submitted!
            </Text>
            <Text variant="bodyMd" as="p" alignment="center">
              {data.message}
            </Text>
            <Button onClick={() => window.location.reload()}>Submit Another Return</Button>
          </BlockStack>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <Card>
        <BlockStack gap="400">
          <Text variant="headingXl" as="h1" fontWeight="bold">
            Start a Return
          </Text>
          <Text variant="bodyMd" as="p" tone="subdued">
            Enter your email and find your order to start a return or exchange.
          </Text>

          <fetcher.Form method="post" onSubmit={handleLookup}>
            <input type="hidden" name="_action" value="lookup" />
            <input type="hidden" name="shop" value={shop} />

            <BlockStack gap="300">
              <TextField
                label="Email Address"
                type="email"
                name="email"
                value={email}
                onChange={setEmail}
                placeholder="your@email.com"
                autoComplete="email"
                required
              />

              <Button submit variant="primary" loading={isLookup} disabled={!email}>
                Look Up My Orders
              </Button>
            </BlockStack>
          </fetcher.Form>

          {error && (
            <Banner tone="critical">{error}</Banner>
          )}

          {orders.length > 0 && customer && (
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2" fontWeight="bold">
                Welcome, {customer.name}!
              </Text>
              <Text variant="bodyMd" as="p">
                Select an order to return items from:
              </Text>

              {orders.map((order: any) => {
                const orderTotal = parseFloat(order.total);
                const isSelected = selectedOrder === order.id;
                return (
                  <Card
                    key={order.id}
                    background={isSelected ? "bg-surface-experimental" : undefined}
                  >
                    <div
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedOrder(isSelected ? null : order.id);
                        setSelectedItems([]);
                      }}
                    >
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3" fontWeight="bold">
                            {order.name}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {new Date(order.createdAt).toLocaleDateString()} · {order.currency} ${orderTotal.toFixed(2)}
                          </Text>
                        </BlockStack>
                        {order.fulfilled && <Text variant="bodySm" as="span" tone="success">Delivered</Text>}
                      </InlineStack>
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: 16 }}>
                        <fetcher.Form method="post">
                          <input type="hidden" name="_action" value="submit_return" />
                          <input type="hidden" name="shop" value={shop} />
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="orderName2" value={order.name} />
                          <input type="hidden" name="customerName" value={customer.name} />
                          <input type="hidden" name="customerEmail" value={email} />
                          <input type="hidden" name="selectedItems" value={JSON.stringify(
                            order.items.filter((i: any) => selectedItems.includes(i.id))
                          )} />
                          <input type="hidden" name="reason" value={reason} />

                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h4" fontWeight="bold">
                              Select items to return:
                            </Text>

                            {order.items.map((item: any) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "8px 0",
                                  borderBottom: "1px solid #e0e0e0",
                                }}
                              >
                                <Checkbox
                                  label=""
                                  checked={selectedItems.includes(item.id)}
                                  onChange={() => toggleItem(item.id)}
                                />
                                <div style={{ flex: 1 }}>
                                  <Text variant="bodyMd" as="span" fontWeight="bold">
                                    {item.title}
                                  </Text>
                                  <Text variant="bodySm" as="p" tone="subdued">
                                    x{item.quantity} · ${item.price}
                                    {item.sku && ` · SKU: ${item.sku}`}
                                  </Text>
                                </div>
                              </div>
                            ))}

                            <TextField
                              label="Reason for return"
                              name="reason"
                              value={reason}
                              onChange={setReason}
                              placeholder="e.g. Wrong size, defective, changed mind..."
                              multiline={2}
                            />

                            <Button
                              submit
                              variant="primary"
                              disabled={selectedItems.length === 0}
                            >
                              Submit Return Request
                            </Button>
                          </BlockStack>
                        </fetcher.Form>
                      </div>
                    )}
                  </Card>
                );
              })}
            </BlockStack>
          )}

          {!isLookup && orders.length === 0 && !error && (
            <Banner tone="info">
              <p>Enter your email above to find your orders and start a return.</p>
            </Banner>
          )}
        </BlockStack>
      </Card>
    </div>
  );
}