import "@shopify/shopify-app-remix/server/adapters/node";
import {
  AppDistribution,
  shopifyApp,
  ApiVersion,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { BillingInterval } from "@shopify/shopify-api";
import prisma from "./lib/db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/api/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    free: {
      lineItems: [
        { amount: 0, currencyCode: "USD", interval: BillingInterval.Every30Days },
      ],
    },
    growth: {
      lineItems: [
        { amount: 9.99, currencyCode: "USD", interval: BillingInterval.Every30Days },
      ],
    },
    pro: {
      lineItems: [
        { amount: 29, currencyCode: "USD", interval: BillingInterval.Every30Days },
      ],
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

export default shopify;
export const authenticate = shopify.authenticate;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
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