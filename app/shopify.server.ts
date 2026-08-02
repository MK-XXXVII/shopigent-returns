import "@shopify/shopify-app-remix/server/adapters/node";
import {
  AppDistribution,
  shopifyApp,
  ApiVersion,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
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
  future: {
    expiringOfflineAccessTokens: true,
  },
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