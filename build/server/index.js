import { jsx, jsxs } from 'react/jsx-runtime';
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useRouteError, isRouteErrorResponse, useLoaderData } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { AppProvider, useIndexResourceState, IndexTable, Link, Badge, Page, Layout, BlockStack, Text, Card, Banner } from '@shopify/polaris';
import '@shopify/shopify-app-remix/server/adapters/node';
import { shopifyApp, DeliveryMethod, AppDistribution, ApiVersion } from '@shopify/shopify-app-remix/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { restResources } from '@shopify/shopify-api/rest/admin/2024-10';
import { PrismaClient } from '@prisma/client';
import { json } from '@remix-run/node';
import { TitleBar } from '@shopify/app-bridge-react';

async function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  const body = await renderToReadableStream(
    /* @__PURE__ */ jsx(RemixServer, { context: remixContext, url: request.url }),
    {
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      }
    }
  );
  if (isbot(request.headers.get("user-agent") || "")) {
    await body.allReady;
  }
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

const entryServer = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: 'Module' }));

function App() {
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/inter.css"
        }
      ),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(AppProvider, { i18n: {}, children: /* @__PURE__ */ jsx(Outlet, {}) }),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("h1", { children: [
        error.status,
        " ",
        error.statusText
      ] }),
      /* @__PURE__ */ jsx("p", { children: error.data })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { children: "Error" }),
    /* @__PURE__ */ jsx("p", { children: error?.message ?? "Unknown error" })
  ] });
}

const route0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App
}, Symbol.toStringTag, { value: 'Module' }));

let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}
const prisma$1 = prisma;

const shopify = shopifyApp({
  api: {
    restResources,
    apiVersion: ApiVersion.October24,
    distribution: AppDistribution.AppStore,
    future: {
      expiringOfflineAccessTokens: true
    },
    hooks: {
      afterAuth: async ({ session }) => {
        shopify.registerWebhooks({ session });
      }
    }
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback"
  },
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/api/webhooks/app/uninstalled"
    },
    ORDERS_FULFILLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/api/webhooks/orders/fulfilled"
    }
  },
  sessionStorage: new PrismaSessionStorage(prisma$1),
  useOnlineTokens: true
});

async function action({ request }) {
  const { topic, shop, session, admin } = await shopify.authenticate.webhook(
    request
  );
  switch (topic) {
    case "APP_UNINSTALLED": {
      await prisma$1.shop.updateMany({
        where: { shop },
        data: { uninstalledAt: /* @__PURE__ */ new Date() }
      });
      break;
    }
    case "ORDERS_FULFILLED": {
      const payload = await request.json();
      const orderId = payload.id;
      const orderName = payload.name;
      const customerEmail = payload.email || payload.contact_email;
      const customerName = payload.customer ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() : null;
      await prisma$1.returnRequest.create({
        data: {
          shop,
          orderId: `gid://shopify/Order/${orderId}`,
          orderName,
          customerEmail,
          customerName,
          items: (payload.line_items || []).map((item) => ({
            variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku
          })),
          status: "PENDING"
        }
      });
      break;
    }
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }
  return new Response(null, { status: 200 });
}

const route1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action
}, Symbol.toStringTag, { value: 'Module' }));

const loader = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const totalReturns = await prisma$1.returnRequest.count({ where: { shop } });
  const pendingReturns = await prisma$1.returnRequest.count({
    where: { shop, status: "PENDING" }
  });
  const approvedToday = await prisma$1.returnRequest.count({
    where: {
      shop,
      status: "APPROVED",
      decidedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1e3) }
    }
  });
  const totalRefunded = await prisma$1.returnRequest.aggregate({
    where: { shop, status: "REFUNDED" },
    _sum: { refundAmount: true }
  });
  const recentReturns = await prisma$1.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  return json({
    stats: {
      totalReturns,
      pendingReturns,
      approvedToday,
      totalRefunded: totalRefunded._sum.refundAmount || 0
    },
    recentReturns
  });
};
function statusBadge(status) {
  const map = {
    PENDING: { children: "Pending", status: "warning" },
    APPROVED: { children: "Approved", status: "success" },
    DENIED: { children: "Denied", status: "critical" },
    EXCHANGE: { children: "Exchange", status: "info" },
    SHIPPED: { children: "Shipped", status: "info" },
    REFUNDED: { children: "Refunded", status: "success" },
    CLOSED: { children: "Closed", status: "new" }
  };
  return map[status] || { children: status, status: "info" };
}
function Dashboard() {
  const { stats, recentReturns } = useLoaderData();
  const resourceName = {
    singular: "return",
    plural: "returns"
  };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(recentReturns);
  const rowMarkup = recentReturns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => /* @__PURE__ */ jsxs(
      IndexTable.Row,
      {
        id,
        selected: selectedResources.includes(id),
        position: index,
        children: [
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Link, { url: `/returns/${id}`, children: orderName || "—" }) }),
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: customerName || "—" }),
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: statusBadge(status).status, children: statusBadge(status).children }) }),
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: new Date(createdAt).toLocaleDateString() })
        ]
      },
      id
    )
  );
  return /* @__PURE__ */ jsxs(Page, { title: "Dashboard", children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Shopigent Returns" }),
    /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Overview" }),
        /* @__PURE__ */ jsxs(Layout, { children: [
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", children: stats.totalReturns }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: "Total Returns" })
          ] }) }) }),
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", tone: "critical", children: stats.pendingReturns }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: "Pending Review" })
          ] }) }) }),
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(Text, { variant: "headingXl", as: "p", fontWeight: "bold", tone: "success", children: [
              "$",
              Number(stats.totalRefunded).toFixed(2)
            ] }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: "Total Refunded" })
          ] }) }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Recent Returns" }),
        recentReturns.length === 0 ? /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "No returns yet. Returns will appear here when customers submit them." }) }) : /* @__PURE__ */ jsx(
          IndexTable,
          {
            resourceName,
            itemCount: recentReturns.length,
            selectedItemsCount: allResourcesSelected ? "All" : selectedResources.length,
            onSelectionChange: handleSelectionChange,
            headings: [
              { title: "Order" },
              { title: "Customer" },
              { title: "Status" },
              { title: "Date" }
            ],
            children: rowMarkup
          }
        )
      ] }) }) })
    ] })
  ] });
}

const route2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader
}, Symbol.toStringTag, { value: 'Module' }));

const serverManifest = {'entry':{'module':'/assets/entry.client-Bqo-IvZX.js','imports':['/assets/components-BwhtaCD-.js'],'css':[]},'routes':{'root':{'id':'root','parentId':undefined,'path':'','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':true,'module':'/assets/root-DZ-6-OcD.js','imports':['/assets/components-BwhtaCD-.js','/assets/context-BIm_pb6h.js'],'css':['/assets/root-DqWBAKNB.css']},'routes/api.webhooks':{'id':'routes/api.webhooks','parentId':'root','path':'api/webhooks','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.webhooks-l0sNRNKZ.js','imports':[],'css':[]},'routes/_index':{'id':'routes/_index','parentId':'root','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/_index-C8OliW_H.js','imports':['/assets/components-BwhtaCD-.js','/assets/context-BIm_pb6h.js'],'css':[]}},'url':'/assets/manifest-cafcb98f.js','version':'cafcb98f'};

/**
       * `mode` is only relevant for the old Remix compiler but
       * is included here to satisfy the `ServerBuild` typings.
       */
      const mode = "production";
      const assetsBuildDirectory = "build/client";
      const basename = "/";
      const future = {"v3_fetcherPersist":false,"v3_relativeSplatPath":false,"v3_throwAbortReason":false,"v3_routeConfig":false,"v3_singleFetch":false,"v3_lazyRouteDiscovery":false,"unstable_optimizeDeps":false};
      const isSpaMode = false;
      const publicPath = "/";
      const entry = { module: entryServer };
      const routes = {
        "root": {
          id: "root",
          parentId: undefined,
          path: "",
          index: undefined,
          caseSensitive: undefined,
          module: route0
        },
  "routes/api.webhooks": {
          id: "routes/api.webhooks",
          parentId: "root",
          path: "api/webhooks",
          index: undefined,
          caseSensitive: undefined,
          module: route1
        },
  "routes/_index": {
          id: "routes/_index",
          parentId: "root",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route2
        }
      };

export { serverManifest as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, mode, publicPath, routes };
