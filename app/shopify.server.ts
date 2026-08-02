import "@shopify/shopify-app-remix/server/adapters/node";
import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  LATEST_API_VERSION,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import prisma from "./lib/db.server";

const shopify = shopifyApp({
  api: {
    restResources,
    apiVersion: LATEST_API_VERSION,
    distribution: AppDistribution.AppStore,
    future: {
      expiringOfflineAccessTokens: true,
    },
    hooks: {
      afterAuth: async ({ session }) => {
        shopify.registerWebhooks({ session });
      },
    },
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/api/webhooks/app/uninstalled",
    },
    ORDERS_FULFILLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/api/webhooks/orders/fulfilled",
    },
  },
  sessionStorage: PrismaSessionStorage(prisma),
  useOnlineTokens: true,
});

export default shopify;
export const addDocumentResponseHeaders = (
  request: Request,
  response: Response
) => {
  const { shop } = request.headers as unknown as Record<string, string>;
  if (shop) {
    response.headers.set(
      "Content-Security-Policy",
      `frame-ancestors https://${shop} https://admin.shopify.com;`
    );
  }
};