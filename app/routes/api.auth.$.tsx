import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, registerWebhooks } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Register webhooks for this shop (if not already registered)
  try {
    await registerWebhooks({ session });
  } catch (error) {
    // Webhooks may already be registered — that's fine
    console.log(`[auth] Webhook registration: ${error}`);
  }

  return null;
};