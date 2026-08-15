import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  Link,
  useLoaderData,
} from "@remix-run/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate, login } from "./shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Public routes (customer portal) — no Shopify admin auth
  const isPublic = url.pathname.startsWith("/return") || url.pathname.startsWith("/api/auth");
  if (!isPublic) {
    // Skip auth if no shop param (e.g. stale embedded nav) — let the remount handle it
    const shop = url.searchParams.get("shop");
    if (shop) {
      await authenticate.admin(request);
    } else {
      // No shop param — redirect to login to let the framework handle re-auth
      await login(request);
    }
  }
  return { apiKey: process.env.SHOPIFY_API_KEY || "", isPublic };
};

export default function App() {
  const { apiKey, isPublic } = useLoaderData<typeof loader>();

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/inter.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {isPublic ? (
          <PolarisAppProvider i18n={{}}>
            <Outlet />
          </PolarisAppProvider>
        ) : (
          <ShopifyAppProvider isEmbeddedApp apiKey={apiKey}>
            <NavMenu>
              <Link to="/">Dashboard</Link>
              <Link to="/policies">Policies</Link>
              <Link to="/returns">Returns</Link>
              <Link to="/analytics">Analytics</Link>
              <Link to="/app/billing">Billing</Link>
              <Link to="/settings">Settings</Link>
              <Link to="/app/fraud-rules">Fraud Rules</Link>
            </NavMenu>
            <Outlet />
          </ShopifyAppProvider>
          )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Error</h1>
      <p>{(error as Error)?.message ?? "Unknown error"}</p>
    </div>
  );
}