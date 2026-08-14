// Helper: generate a return shipping label and email it to the customer
import { createReturnLabel, type LabelRequest } from "./label-provider.server";
import { sendEmail, returnLabelEmail } from "./email.server";

export interface LabelNotifyResult {
  success: boolean;
  labelUrl?: string;
  trackingNumber?: string;
  error?: string;
  skipped?: boolean; // label generation skipped (not configured)
}

// Build a LabelRequest from a return record
export function buildLabelRequest(
  shop: string,
  returnRec: {
    orderName?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    items: any[];
  },
  shopAddress?: any
): LabelRequest {
  const items = (returnRec.items || []).map((i: any) => ({
    title: i.title || "Item",
    quantity: i.quantity || 1,
    sku: i.sku || "",
  }));
  return {
    orderName: returnRec.orderName || "Return",
    customerName: returnRec.customerName || "Customer",
    customerEmail: returnRec.customerEmail || "",
    items,
    weight: 1,
    description: `Return for ${returnRec.orderName || "order"}`,
    shopAddress: shopAddress || {
      line1: process.env.SHOP_ADDRESS_LINE1 || "",
      city: process.env.SHOP_ADDRESS_CITY || "",
      postalCode: process.env.SHOP_ADDRESS_ZIP || "",
      country: process.env.SHOP_ADDRESS_COUNTRY || "NL",
    },
  };
}

// Generate a label and email it to the customer.
// If no label provider is configured and allowTest is true, sends a placeholder
// label URL so the pipeline can be verified end-to-end.
export async function generateAndEmailReturnLabel(
  shop: string,
  returnRec: any,
  opts?: { allowTest?: boolean }
): Promise<LabelNotifyResult> {
  const customerEmail = returnRec.customerEmail;
  const orderName = returnRec.orderName || "order";

  if (!customerEmail) {
    return { success: false, error: "No customer email — cannot send label", skipped: true };
  }

  const labelRequest = buildLabelRequest(shop, returnRec);
  const result = await createReturnLabel(shop, labelRequest);

  // If no provider configured (or provider error due to missing keys), optionally test email with placeholder
  if (!result.success && opts?.allowTest && /not configured/i.test(result.error || "")) {
    const placeholderUrl = `https://returns-docs.greeknous.com/demo-label?order=${encodeURIComponent(orderName)}`;
    await sendEmail({
      ...returnLabelEmail(returnRec.customerName || "Customer", orderName, placeholderUrl),
      to: customerEmail,
    });
    return { success: true, skipped: true, labelUrl: placeholderUrl };
  }

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (!result.labelUrl) {
    return { success: false, error: "Label generated but no URL returned", skipped: true };
  }

  await sendEmail({
    ...returnLabelEmail(returnRec.customerName || "Customer", orderName, result.labelUrl, result.trackingNumber),
    to: customerEmail,
  });

  return {
    success: true,
    labelUrl: result.labelUrl,
    trackingNumber: result.trackingNumber,
  };
}