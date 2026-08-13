// Shopify Admin API helper with automatic token refresh
// Handles expiring offline access tokens by refreshing via OAuth

import prisma from "./db.server";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

interface ShopifyResponse {
  data?: any;
  errors?: any;
}

export async function shopifyAdminQuery(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, any>,
  idempotencyKey?: string
): Promise<ShopifyResponse> {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": accessToken,
  };
  if (idempotencyKey) {
    headers["X-Shopify-Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401) {
    // Token expired — attempt refresh
    const refreshed = await tryRefreshToken(shop);
    if (refreshed) {
      // Retry with new token
      const retryResp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": refreshed,
        },
        body: JSON.stringify({ query, variables }),
      });
      return retryResp.json();
    }
    // If refresh also failed, throw
    throw new Error(`Shopify API token expired and refresh failed for ${shop}`);
  }

  return response.json();
}

// Refresh an expired offline access token using the stored refresh token
export async function tryRefreshToken(shop: string): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
  });

  if (!session?.refreshToken || !session?.accessToken) {
    console.log(`[shopify] No refresh token available for ${shop}`);
    return null;
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log(`[shopify] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET`);
    return null;
  }

  try {
    const response = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: apiKey,
          client_secret: apiSecret,
          grant_type: "refresh_token",
          refresh_token: session.refreshToken,
        }).toString(),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.log(`[shopify] Token refresh failed for ${shop}: ${text}`);
      return null;
    }

    const data = await response.json();

    // Update session with new tokens
    await prisma.session.update({
      where: { id: session.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || session.refreshToken,
        expires: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : undefined,
      },
    });

    console.log(`[shopify] Token refreshed successfully for ${shop}`);
    return data.access_token;
  } catch (err: any) {
    console.log(`[shopify] Token refresh error for ${shop}: ${err.message}`);
    return null;
  }
}

// Look up a customer's orders by email using REST orders endpoint
export async function getOrdersByEmail(shop: string, accessToken: string, email: string) {
  const url = `https://${shop}/admin/api/${API_VERSION}/orders.json?email=${encodeURIComponent(email)}&status=any&limit=50`;
  const response = await fetch(url, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  if (response.status === 401) {
    const refreshed = await tryRefreshToken(shop);
    if (refreshed) {
      const retryResp = await fetch(url, {
        headers: { "X-Shopify-Access-Token": refreshed },
      });
      return retryResp.json();
    }
  }
  return response.json();
}

// Execute a refund via GraphQL mutation
export async function executeRefund(
  shop: string,
  accessToken: string,
  orderId: string,
  amount: number,
  restock: boolean = true,
  reason: string = "Customer return"
) {
  const orderGid = orderId.startsWith("gid://")
    ? orderId
    : `gid://shopify/Order/${orderId}`;

  // Step 1: Get order line items and payment transaction
  const orderQuery = `{
    order(id: "${orderGid}") {
      id
      transactions(first: 5) { edges { node { id amountSet { shopMoney { amount } } kind } } }
      lineItems(first: 20) { edges { node { id quantity } } }
    }
  }`;

  const orderResult = await shopifyAdminQuery(shop, accessToken, orderQuery);
  const order = orderResult?.data?.order;
  if (!order) {
    console.error("[refund] Order lookup failed:", JSON.stringify(orderResult?.errors || orderResult));
    // If protected customer data is blocked, try to refund without order lookup
    const directRefundQuery = `mutation refundCreate($input: RefundInput!) @idempotent {
      refundCreate(input: $input) {
        refund { id transactions(first: 10) { nodes { id status } } }
        userErrors { field message }
      }
    }`;
    const fallbackKey = `${orderId}-${Date.now()}-fallback`;
    const directResult = await shopifyAdminQuery(shop, accessToken, directRefundQuery, {
      input: {
        orderId: orderGid,
        refundLineItems: [],
        note: reason,
        transactions: [{
          amount: amount.toString(),
          gateway: "manual",
          kind: "REFUND",
          orderId: orderGid,
        }],
      },
    }, fallbackKey);
    // Check top-level GraphQL errors
    if (directResult?.errors?.length) {
      throw new Error(`Refund GraphQL error: ${directResult.errors.map((e: any) => e.message).join(", ")}`);
    }
    const directErrors = directResult?.data?.refundCreate?.userErrors;
    if (directErrors?.length > 0) {
      throw new Error(`Refund failed: ${directErrors.map((e: any) => e.message).join(", ")}`);
    }
    return directResult?.data?.refundCreate?.refund;
  }

  // Find the payment transaction (captured/sale)
  const paymentTx = order.transactions?.edges?.find(
    (e: any) => e.node.kind === "CAPTURE" || e.node.kind === "SALE" || e.node.kind === "AUTHORIZATION"
  )?.node;

  // Build refund line items from the order
  const refundLineItems = order.lineItems?.edges?.map((e: any) => ({
    lineItemId: e.node.id,
    quantity: e.node.quantity,
    restockType: restock ? "RETURN" : "NO_RESTOCK",
  })) || [];

  // Step 2: Execute refund directly (no calculateRefund needed)
  const idempotencyKey = `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const execQuery = `mutation refundCreate($input: RefundInput!) @idempotent {
    refundCreate(input: $input) {
      refund { id transactions(first: 10) { nodes { id status processedAt amountSet { shopMoney { amount } } } } }
      userErrors { field message }
    }
  }`;

  const execInput: any = {
    orderId: orderGid,
    refundLineItems,
    note: reason,
    transactions: paymentTx ? [{
      parentId: paymentTx.id,
      amount: amount.toString(),
      gateway: "shopify",
      kind: "REFUND",
    }] : [{
      amount: amount.toString(),
      gateway: "shopify",
      kind: "REFUND",
    }],
  };

  const execResult = await shopifyAdminQuery(shop, accessToken, execQuery, { input: execInput }, idempotencyKey);

  // Check top-level GraphQL errors
  if (execResult?.errors?.length) {
    throw new Error(`Refund GraphQL error: ${execResult.errors.map((e: any) => e.message).join(", ")}`);
  }
  const execErrors = execResult?.data?.refundCreate?.userErrors;
  if (execErrors?.length > 0) {
    throw new Error(`Refund execution failed: ${execErrors.map((e: any) => e.message).join(", ")}`);
  }

  return execResult?.data?.refundCreate?.refund;
}

// Create a draft order for a replacement item (exchange)
export async function createDraftOrder(
  shop: string,
  accessToken: string,
  lineItems: { variantId: string; quantity: number; title?: string }[],
  customerEmail?: string,
  note?: string
): Promise<{ draftOrderId: string | null; error?: string }> {
  const mutation = `mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl }
      userErrors { field message }
    }
  }`;

  const variables: any = {
    input: {
      lineItems: lineItems.map((li) => ({
        variantId: li.variantId,
        quantity: li.quantity,
        appliedDiscount: { value: 100, valueType: "percentage", title: "Exchange - no charge" },
      })),
      note: note || "Exchange replacement order",
      useCustomerDefaultAddress: true,
    },
  };

  if (customerEmail) {
    variables.input.email = customerEmail;
    variables.input.sendInvoice = true;
  }

  const result = await shopifyAdminQuery(shop, accessToken, mutation, variables);

  const errors = result?.data?.draftOrderCreate?.userErrors;
  if (errors?.length > 0) {
    return { draftOrderId: null, error: errors.map((e: any) => e.message).join(", ") };
  }

  const draftOrder = result?.data?.draftOrderCreate?.draftOrder;
  if (!draftOrder?.id) {
    return { draftOrderId: null, error: "Failed to create draft order" };
  }

  return { draftOrderId: draftOrder.id };
}

// Create a store credit discount code for a customer
export async function createStoreCredit(
  shop: string,
  accessToken: string,
  amount: number,
  customerEmail: string,
  reason: string
): Promise<{ discountCode: string; discountId: string | null; error?: string }> {
  const code = `STORE-CREDIT-${Date.now().toString(36).toUpperCase()}`;

  const mutation = `mutation discountCodeBasicCreate($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            codes(first: 1) {
              edges {
                node { code }
              }
            }
          }
        }
      }
      userErrors { field message }
    }
  }`;

  const variables = {
    input: {
      title: `Store Credit - ${reason || "Return"}`,
      code,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      customerSelection: {
        customers: [{ email: customerEmail }],
      },
      appliesOncePerCustomer: true,
      usageLimit: 1,
      discountType: "FIXED_AMOUNT" as const,
      discountValue: { amount },
      appliesOn: { all: true },
    },
  };

  const result = await shopifyAdminQuery(shop, accessToken, mutation, variables);

  const errors = result?.data?.discountCodeBasicCreate?.userErrors;
  if (errors?.length > 0) {
    return { discountCode: "", discountId: null, error: errors.map((e: any) => e.message).join(", ") };
  }

  const discountNode = result?.data?.discountCodeBasicCreate?.codeDiscountNode;
  const discountCode = discountNode?.codeDiscount?.codes?.edges?.[0]?.node?.code || code;

  return { discountCode, discountId: discountNode?.id || null };
}