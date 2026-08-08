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
  variables?: Record<string, any>
): Promise<ShopifyResponse> {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
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
async function tryRefreshToken(shop: string): Promise<string | null> {
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
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          refresh_token: session.refreshToken,
          access_token: session.accessToken,
          grant_type: "refresh_token",
        }),
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

// Look up a customer's orders by email using REST
export async function getOrdersByEmail(shop: string, accessToken: string, email: string) {
  const url = `https://${shop}/admin/api/${API_VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}`;
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

  // Step 1: Calculate refund
  const calcQuery = `mutation calculate($input: CalculateRefundInput!) {
    calculateRefund(input: $input) {
      refund { transactions { id amountSet { shopMoney { amount } } kind } }
      userErrors { field message }
    }
  }`;

  const calcResult = await shopifyAdminQuery(shop, accessToken, calcQuery, {
    input: {
      orderId: orderGid,
      amount: { amount, currencyCode: "USD" },
      refundLineItems: [],
      restock,
    },
  });

  const calcErrors = calcResult?.data?.calculateRefund?.userErrors;
  if (calcErrors?.length > 0) {
    throw new Error(`Refund calculation failed: ${calcErrors.map((e: any) => e.message).join(", ")}`);
  }

  const calculatedRefund = calcResult?.data?.calculateRefund?.refund;
  if (!calculatedRefund) throw new Error("Failed to calculate refund");

  // Step 2: Execute refund
  const execQuery = `mutation execute($input: RefundInput!) {
    refundCreate(input: $input) {
      refund { id transactions { id status processedAt amountSet { shopMoney { amount } } } }
      userErrors { field message }
    }
  }`;

  const execResult = await shopifyAdminQuery(shop, accessToken, execQuery, {
    input: {
      orderId: orderGid,
      amount: { amount, currencyCode: "USD" },
      restock,
      note: reason,
      transactions: calculatedRefund.transactions?.map((t: any) => ({
        id: t.id,
        amount: { amount: amount.toString(), currencyCode: "USD" },
        kind: "refund",
        gateway: t.id,
      })),
      refundLineItems: [],
    },
  });

  const execErrors = execResult?.data?.refundCreate?.userErrors;
  if (execErrors?.length > 0) {
    throw new Error(`Refund execution failed: ${execErrors.map((e: any) => e.message).join(", ")}`);
  }

  return execResult?.data?.refundCreate?.refund;
}