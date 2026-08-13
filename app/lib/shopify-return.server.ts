import { shopifyAdminQuery } from "./shopify-admin.server";

// Create a Shopify Return on the order via returnRequest
// Uses the simple REST API approach to get fulfillment line items
export async function createShopifyReturn(
  shop: string,
  accessToken: string,
  orderId: string,
  items: { variantId: string; quantity: number }[]
): Promise<{ returnId?: string; error?: string }> {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
  const numericOrderId = orderId.replace("gid://shopify/Order/", "");

  // Step 1: Get order via REST API (simpler) to find fulfillment IDs
  const restUrl = `https://${shop}/admin/api/2026-10/orders/${numericOrderId}.json`;
  const restResp = await fetch(restUrl, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  const restData = await restResp.json();
  const order = restData?.order;

  if (!order) {
    return { error: "Order not found" };
  }

  console.log(`[shopify-return] REST order:`, JSON.stringify({
    id: order.id,
    name: order.name,
    fulfillment_status: order.fulfillment_status,
    line_items: order.line_items?.map((li: any) => ({ id: li.id, variant_id: li.variant_id, fulfillable_quantity: li.fulfillable_quantity })),
    fulfillments: order.fulfillments?.map((f: any) => ({ id: f.id, status: f.status, line_items: f.line_items?.map((fli: any) => ({ id: fli.id, line_item_id: fli.line_item_id })) })),
  }).slice(0, 3000));

  // Step 2: Build return line items with fulfillmentLineItemId
  const returnLineItems: any[] = [];

  for (const reqItem of items) {
    const variantId = reqItem.variantId.replace("gid://shopify/ProductVariant/", "");
    let fulfillmentLineItemId: string | null = null;

    // Search through REST fulfillments
    for (const fulfillment of (order.fulfillments || [])) {
      for (const fli of (fulfillment.line_items || [])) {
        // Check if this fulfillment line item matches our variant
        const matchingLineItem = order.line_items?.find((li: any) => li.id === fli.line_item_id);
        if (matchingLineItem && String(matchingLineItem.variant_id) === variantId) {
          // Convert REST fulfillment line item ID to GID format
          fulfillmentLineItemId = `gid://shopify/FulfillmentLineItem/${fli.id}`;
          break;
        }
      }
      if (fulfillmentLineItemId) break;
    }

    if (!fulfillmentLineItemId) {
      return { error: `Item variant ${variantId} hasn't been fulfilled. Fulfill the order in Shopify admin first.` };
    }

    returnLineItems.push({
      fulfillmentLineItemId,
      quantity: reqItem.quantity,
    });
  }

  // Step 3: Create the return
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
    return { error: "Failed to create return: no return object" };
  }

  return { returnId: returnObj.id };
}