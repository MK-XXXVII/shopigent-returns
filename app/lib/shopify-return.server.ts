import { shopifyAdminQuery } from "./shopify-admin.server";

// Create a Shopify Return — uses GraphQL to find fulfillment line items
export async function createShopifyReturn(
  shop: string,
  accessToken: string,
  orderId: string,
  items: { variantId: string; quantity: number }[],
  reason?: string
): Promise<{ returnId?: string; error?: string }> {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;

  // Step 1: Get fulfillment line items via GraphQL
  const query = `{
    order(id: "${orderGid}") {
      id
      displayFulfillmentStatus
      fulfillments(first: 10) {
        id
        fulfillmentLineItems(first: 50) {
          edges { node { id lineItem { id variant { id } } quantity } }
        }
      }
    }
  }`;

  const result = await shopifyAdminQuery(shop, accessToken, query);
  console.log(`[shopify-return] GraphQL:`, JSON.stringify(result).slice(0, 3000));

  // Check for GraphQL errors
  if (result?.errors) {
    const msg = result.errors.map((e: any) => e.message).join(", ");
    console.error(`[shopify-return] GraphQL error: ${msg}`);
    return { error: `GraphQL error: ${msg}` };
  }

  const fulfillments = result?.data?.order?.fulfillments || [];
  if (fulfillments.length === 0) {
    return { error: "Order has no fulfillments. Create a fulfillment first." };
  }

  // Step 2: Build return line items
  const returnLineItems: any[] = [];

  for (const reqItem of items) {
    const variantId = reqItem.variantId.replace("gid://shopify/ProductVariant/", "");
    let found = false;

    for (const fulfillment of fulfillments) {
      const fliNodes = fulfillment.fulfillmentLineItems?.edges?.map((e: any) => e.node) || [];
      for (const fli of fliNodes) {
        const fliVariantId = fli.lineItem?.variant?.id?.replace("gid://shopify/ProductVariant/", "");
        if (fliVariantId === variantId) {
          returnLineItems.push({
            fulfillmentLineItemId: fli.id,
            quantity: reqItem.quantity,
          });
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      return { error: `Variant ${variantId} not found in any fulfillment` };
    }
  }

  // Step 3: Create the return request
  // Map a customer reason to a ReturnReason enum or default to OTHER
  const rawReason = (reason || "").toLowerCase();
  let returnReason = "OTHER";
  if (rawReason.includes("defect") || rawReason.includes("damag") || rawReason.includes("broken")) returnReason = "DEFECTIVE";
  else if (rawReason.includes("size") || rawReason.includes("fit")) returnReason = "SIZE_TOO_SMALL";
  else if (rawReason.includes("color")) returnReason = "COLOR";
  else if (rawReason.includes("wrong")) returnReason = "WRONG_ITEM";
  else if (rawReason.includes("not as described") || rawReason.includes("different")) returnReason = "NOT_AS_DESCRIBED";
  else if (rawReason.includes("unwanted") || rawReason.includes("changed") || rawReason.includes("want")) returnReason = "UNWANTED";
  else if (rawReason.includes("style")) returnReason = "STYLE";

  const mutation = `mutation returnRequest($input: ReturnRequestInput!) {
    returnRequest(input: $input) {
      return { id status }
      userErrors { field message }
    }
  }`;

  const createResult = await shopifyAdminQuery(shop, accessToken, mutation, {
    input: {
      orderId: orderGid,
      returnLineItems: returnLineItems.map((li) => ({
        ...li,
        returnReason,
        customerNote: reason ? reason.slice(0, 300) : undefined,
      })),
    },
  });

  console.log(`[shopify-return] Create:`, JSON.stringify(createResult).slice(0, 2000));

  if (createResult?.errors?.length) {
    return { error: createResult.errors.map((e: any) => e.message).join(", ") };
  }
  const errors = createResult?.data?.returnRequest?.userErrors;
  if (errors?.length > 0) {
    return { error: errors.map((e: any) => e.message).join(", ") };
  }
  const returnObj = createResult?.data?.returnRequest?.return;
  return returnObj
    ? { returnId: returnObj.id }
    : { error: "Failed to create return" };
}