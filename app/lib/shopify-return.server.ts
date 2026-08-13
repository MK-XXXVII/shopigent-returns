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

  const mutation = `mutation returnCreate($returnInput: ReturnInput!) {
    returnCreate(returnInput: $returnInput) {
      return { id status }
      userErrors { field message }
    }
  }`;

  const result = await shopifyAdminQuery(shop, accessToken, mutation, {
    returnInput: {
      orderId: orderGid,
      returnLineItems: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    },
  });

  console.log(`[shopify-return] Request for ${orderGid}:`, JSON.stringify(items));
  console.log(`[shopify-return] Response:`, JSON.stringify(result).slice(0, 2000));

  // Check top-level GraphQL errors
  if (result?.errors?.length) {
    const msgs = result.errors.map((e: any) => e.message).join(", ");
    console.error(`[shopify-return] GraphQL errors: ${msgs}`);
    return { error: msgs };
  }

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