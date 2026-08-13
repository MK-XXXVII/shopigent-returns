import { shopifyAdminQuery } from "./shopify-admin.server";

// Create a Shopify Return via the Admin API
// This makes the return visible in the Shopify order admin
export async function createShopifyReturn(
  shop: string,
  accessToken: string,
  orderId: string,
  items: { variantId: string; quantity: number }[]
): Promise<{ returnId?: string; error?: string }> {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  const mutation = `mutation returnCreate($input: ReturnInput!) {
    returnCreate(input: $input) {
      return { id status }
      userErrors { field message }
    }
  }`;

  const result = await shopifyAdminQuery(shop, accessToken, mutation, {
    input: {
      orderId: orderGid,
      returnLineItems: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    },
  });

  const errors = result?.data?.returnCreate?.userErrors;
  if (errors?.length > 0) {
    return { error: errors.map((e: any) => e.message).join(", ") };
  }

  const returnObj = result?.data?.returnCreate?.return;
  if (!returnObj) {
    return { error: "Failed to create return" };
  }

  return { returnId: returnObj.id };
}