// Shopify Admin API helper — executes refunds, looks up orders, etc.
// Uses the stored offline access token for the shop.

const SHOPIFY_API_VERSION = "2024-10";

export async function shopifyAdminQuery(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, any>
) {
  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  return response.json();
}

// Look up a customer's orders by email
export async function getOrdersByEmail(shop: string, accessToken: string, email: string) {
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
                totalPriceSet { shopMoney { amount currencyCode } }
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
  return shopifyAdminQuery(shop, accessToken, query);
}

// Execute a refund for a specific order
export async function executeRefund(
  shop: string,
  accessToken: string,
  orderId: string,
  amount: number,
  restock: boolean = true,
  reason: string = "Customer return"
) {
  // Get order GID (if passed as just a number, convert to GID)
  const orderGid = orderId.startsWith("gid://")
    ? orderId
    : `gid://shopify/Order/${orderId}`;

  // First, calculate the refund based on the order
  const calculateMutation = `mutation calculate($input: CalculateRefundInput!) {
    calculateRefund(input: $input) {
      refund {
        id
        transactions {
          id
          amountSet { shopMoney { amount } }
          kind
        }
        orderAdjustments {
          id
          amountSet { shopMoney { amount } }
          reason
        }
      }
      userErrors { field message }
    }
  }`;

  const calculateResult = await shopifyAdminQuery(shop, accessToken, calculateMutation, {
    input: {
      orderId: orderGid,
      amount: { amount, currencyCode: "USD" },
      refundLineItems: [],
      restock: restock,
    },
  });

  const errors = calculateResult?.data?.calculateRefund?.userErrors;
  if (errors?.length > 0) {
    throw new Error(`Refund calculation failed: ${errors.map((e: any) => e.message).join(", ")}`);
  }

  const calculatedRefund = calculateResult?.data?.calculateRefund?.refund;
  if (!calculatedRefund) {
    throw new Error("Failed to calculate refund");
  }

  // Now execute the refund
  const executeMutation = `mutation execute($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        transactions {
          id
          status
          processedAt
          amountSet { shopMoney { amount } }
        }
      }
      userErrors { field message }
    }
  }`;

  const executeResult = await shopifyAdminQuery(shop, accessToken, executeMutation, {
    input: {
      orderId: orderGid,
      amount: { amount, currencyCode: "USD" },
      restock: restock,
      note: reason,
      transactions: calculatedRefund.transactions?.map((t: any) => ({
        id: t.id,
        amount: { amount, currencyCode: "USD" },
        kind: "refund",
        gateway: t.id,
      })),
      refundLineItems: [],
    },
  });

  const execErrors = executeResult?.data?.refundCreate?.userErrors;
  if (execErrors?.length > 0) {
    throw new Error(`Refund execution failed: ${execErrors.map((e: any) => e.message).join(", ")}`);
  }

  return executeResult?.data?.refundCreate?.refund;
}