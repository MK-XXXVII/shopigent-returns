import { shopifyAdminQuery } from "./shopify-admin.server";

// Create a Shopify Return via the Admin API
// Uses fulfillmentLineItemId from the order's line items
export async function createShopifyReturn(
  shop: string,
  accessToken: string,
  orderId: string,
  items: { variantId: string; quantity: number }[]
): Promise<{ returnId?: string; error?: string }> {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  // Step 1: Get order line items to find fulfillmentLineItemIds
  const orderQuery = `{
    order(id: "${orderGid}") {
      id
      lineItems(first: 50) {
        nodes {
          id
          variant { id }
          quantity
          fulfillmentLineItems(first: 10) {
            nodes { id }
          }
        }
      }
    }
  }`;

  const orderResult = await shopifyAdminQuery(shop, accessToken, orderQuery);
  const lineItems = orderResult?.data?.order?.lineItems?.nodes || [];

  // Build return line items with fulfillmentLineItemId
  const returnLineItems: any[] = [];
  for (const reqItem of items) {
    const matching = lineItems.find((li: any) =>
      li.variant?.id === reqItem.variantId || li.variant?.id?.replace("ProductVariant/", "Variant/") === reqItem.variantId
    );
    if (matching) {
      // Use fulfillmentLineItemId if available, otherwise use the line item ID
      const fulfillmentLineItem = matching.fulfillmentLineItems?.nodes?.[0];
      returnLineItems.push({
        fulfillmentLineItemId: fulfillmentLineItem?.id || matching.id,
        quantity: reqItem.quantity,
      });
    }
  }

  if (returnLineItems.length === 0) {
    return { error: "No matching line items found in order" };
  }

  // Step 2: Create the return
  const mutation = `mutation returnCreate($returnInput: ReturnInput!) {
    returnCreate(returnInput: $returnInput) {
      return { id status }
      userErrors { field message }
    }
  }`;

  const result = await shopifyAdminQuery(shop, accessToken, mutation, {
    returnInput: {
      orderId: orderGid,
      returnLineItems,
    },
  });

  console.log(`[shopify-return] Request:`, JSON.stringify(returnLineItems));
  console.log(`[shopify-return] Response:`, JSON.stringify(result).slice(0, 2000));

  if (result?.errors?.length) {
    const msgs = result.errors.map((e: any) => e.message).join(", ");
    return { error: msgs };
  }

  const errors = result?.data?.returnCreate?.userErrors;
  if (errors?.length > 0) {
    return { error: errors.map((e: any) => e.message).join(", ") };
  }

  const returnObj = result?.data?.returnCreate?.return;
  if (!returnObj) {
    return { error: "Failed to create return: no return object in response" };
  }

  return { returnId: returnObj.id };
}