import { shopifyAdminQuery } from "./shopify-admin.server";

// Create a Shopify Return on the order via returnRequest
// This makes the return visible in the Shopify order admin with REQUESTED status
export async function createShopifyReturn(
  shop: string,
  accessToken: string,
  orderId: string,
  items: { variantId: string; quantity: number }[]
): Promise<{ returnId?: string; error?: string }> {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  // Step 1: Get order details including line items and fulfillments
  const orderQuery = `{
    order(id: "${orderGid}") {
      id
      displayFulfillmentStatus
      lineItems(first: 50) {
        nodes {
          id
          variant { id }
          quantity
          fulfillableQuantity
          totalQuantity
        }
      }
      fulfillments(first: 10) {
        id
        status
        lineItems(first: 50) {
          nodes {
            id
            lineItem { id variant { id } }
            quantity
          }
        }
      }
    }
  }`;

  const orderResult = await shopifyAdminQuery(shop, accessToken, orderQuery);
  console.log(`[shopify-return] Order query result:`, JSON.stringify(orderResult).slice(0, 2000));

  const order = orderResult?.data?.order;
  if (!order) {
    return { error: "Order not found or inaccessible" };
  }

  // Step 2: Get fulfillment line item IDs for the items being returned
  const returnLineItems: any[] = [];

  for (const reqItem of items) {
    // Try to find a fulfillment line item matching this variant
    let fulfillmentLineItemId: string | null = null;

    // Search through all fulfillments
    for (const fulfillment of (order.fulfillments || [])) {
      for (const fli of (fulfillment.lineItems?.nodes || [])) {
        if (fli.lineItem?.variant?.id === reqItem.variantId) {
          fulfillmentLineItemId = fli.id;
          break;
        }
      }
      if (fulfillmentLineItemId) break;
    }

    // If no fulfillment line item found, use the line item id as fallback
    if (!fulfillmentLineItemId) {
      const lineItem = (order.lineItems?.nodes || []).find((li: any) =>
        li.variant?.id === reqItem.variantId
      );
      if (lineItem) {
        // We can't use lineItem.id — Shopify requires fulfillmentLineItemId
        // Return a useful error
        return { error: `Item "${reqItem.variantId}" needs to be fulfilled first. Please create a fulfillment in Shopify admin.` };
      }
      return { error: `Item variant ${reqItem.variantId} not found in order` };
    }

    returnLineItems.push({
      fulfillmentLineItemId,
      quantity: reqItem.quantity,
    });
  }

  if (returnLineItems.length === 0) {
    return { error: "No matching items found in order fulfillments" };
  }

  // Step 3: Create the return request (REQUESTED status — merchant must approve)
  const mutation = `mutation returnRequest($input: ReturnRequestInput!) {
    returnRequest(input: $input) {
      return { id status }
      userErrors { field message }
    }
  }`;

  const result = await shopifyAdminQuery(shop, accessToken, mutation, {
    input: {
      orderId: orderGid,
      returnLineItems,
    },
  });

  console.log(`[shopify-return] Create result:`, JSON.stringify(result).slice(0, 2000));

  if (result?.errors?.length) {
    return { error: result.errors.map((e: any) => e.message).join(", ") };
  }

  const errors = result?.data?.returnRequest?.userErrors;
  if (errors?.length > 0) {
    return { error: errors.map((e: any) => e.message).join(", ") };
  }

  const returnObj = result?.data?.returnRequest?.return;
  if (!returnObj) {
    return { error: "Failed to create return" };
  }

  return { returnId: returnObj.id };
}