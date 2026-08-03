import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { RemixServer, useLoaderData, Meta, Links, Outlet, Link, ScrollRestoration, Scripts, useRouteError, isRouteErrorResponse, useFetcher } from '@remix-run/react';
import { renderToString } from 'react-dom/server';
import { AppProvider, useIndexResourceState, IndexTable, Link as Link$1, Badge, Page, Layout, BlockStack, Card, Text, EmptyState, InlineStack, Button, Tag, Banner, Modal, Checkbox, TextField, Select } from '@shopify/polaris';
import { AppProvider as AppProvider$1 } from '@shopify/shopify-app-remix/react';
import { NavMenu, TitleBar } from '@shopify/app-bridge-react';
import '@shopify/shopify-app-remix/server/adapters/node';
import { shopifyApp, AppDistribution, ApiVersion } from '@shopify/shopify-app-remix/server';
import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { PrismaClient } from '@prisma/client';
import { json } from '@remix-run/node';
import { useState, useEffect } from 'react';
import * as crypto from 'node:crypto';

function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  let markup = renderToString(
    /* @__PURE__ */ jsx(RemixServer, { context: remixContext, url: request.url })
  );
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

const entryServer = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: 'Module' }));

const polarisStyles = "/assets/styles-DqWBAKNB.css";

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
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/api/auth",
  sessionStorage: new PrismaSessionStorage(prisma$1),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true
  }
});
const authenticate = shopify.authenticate;
shopify.login;
const registerWebhooks = shopify.registerWebhooks;
shopify.sessionStorage;

const links = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$a = async ({ request }) => {
  const url = new URL(request.url);
  const isPublic = url.pathname.startsWith("/return");
  if (!isPublic) {
    await authenticate.admin(request);
  }
  return { apiKey: process.env.SHOPIFY_API_KEY || "", isPublic };
};
function App() {
  const { apiKey, isPublic } = useLoaderData();
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
      isPublic ? /* @__PURE__ */ jsx(AppProvider, { i18n: {}, children: /* @__PURE__ */ jsx(Outlet, {}) }) : /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
        /* @__PURE__ */ jsxs(NavMenu, { children: [
          /* @__PURE__ */ jsx(Link, { to: "/", children: "Dashboard" }),
          /* @__PURE__ */ jsx(Link, { to: "/policies", children: "Policies" }),
          /* @__PURE__ */ jsx(Link, { to: "/returns", children: "Returns" }),
          /* @__PURE__ */ jsx(Link, { to: "/analytics", children: "Analytics" }),
          /* @__PURE__ */ jsx(Link, { to: "/settings", children: "Settings" })
        ] }),
        /* @__PURE__ */ jsx(Outlet, {})
      ] }),
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
  default: App,
  links,
  loader: loader$a
}, Symbol.toStringTag, { value: 'Module' }));

const STATUS_COLORS$1 = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new"
};
const loader$9 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || void 0;
  const where = { shop: session.shop };
  if (status) where.status = status;
  const returns = await prisma$1.returnRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const counts = await prisma$1.returnRequest.groupBy({
    by: ["status"],
    where: { shop: session.shop },
    _count: true
  });
  const countMap = {};
  counts.forEach((c) => {
    countMap[c.status] = c._count;
  });
  return json({ returns, counts: countMap, currentStatus: status || "all" });
};
function statusBadge$1(status) {
  return {
    children: status.charAt(0) + status.slice(1).toLowerCase(),
    tone: STATUS_COLORS$1[status] || "info"
  };
}
function ReturnsPage() {
  const { returns, counts, currentStatus } = useLoaderData();
  const resourceName = { singular: "return", plural: "returns" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(returns);
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const rowMarkup = returns.map(
    ({ id, orderName, customerName, status, createdAt }, index) => {
      const badge = statusBadge$1(status);
      return /* @__PURE__ */ jsxs(
        IndexTable.Row,
        {
          id,
          selected: selectedResources.includes(id),
          position: index,
          children: [
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Link$1, { url: `/returns/${id}`, children: orderName || "—" }) }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: customerName || "—" }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: badge.tone, children: badge.children }) }),
            /* @__PURE__ */ jsx(IndexTable.Cell, { children: new Date(createdAt).toLocaleDateString() })
          ]
        },
        id
      );
    }
  );
  return /* @__PURE__ */ jsx(Page, { title: "Returns", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
    /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }, children: [
      { label: "All", count: totalCount, key: "all", color: "#5c6ac4" },
      { label: "Pending", count: counts.PENDING || 0, key: "PENDING", color: "#ecc134" },
      { label: "Approved", count: counts.APPROVED || 0, key: "APPROVED", color: "#50b83c" },
      { label: "Denied", count: counts.DENIED || 0, key: "DENIED", color: "#de3617" },
      { label: "Refunded", count: counts.REFUNDED || 0, key: "REFUNDED", color: "#47c1bf" }
    ].map(({ label, count, key, color }) => /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          cursor: "pointer",
          borderLeft: `3px solid ${color}`,
          paddingLeft: 8,
          opacity: currentStatus === key ? 1 : 0.7
        },
        onClick: () => {
          const params = new URLSearchParams(window.location.search);
          if (key === "all") params.delete("status");
          else params.set("status", key);
          window.location.search = params.toString();
        },
        children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "p", fontWeight: "bold", children: count }),
          /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: label })
        ]
      }
    ) }, key)) }),
    /* @__PURE__ */ jsx(Card, { children: returns.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        heading: "No returns yet",
        image: "",
        children: /* @__PURE__ */ jsx("p", { children: "Returns will appear here when customers submit them or when orders are fulfilled." })
      }
    ) : /* @__PURE__ */ jsx(
      IndexTable,
      {
        resourceName,
        itemCount: returns.length,
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
    ) })
  ] }) }) }) });
}

const route1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: ReturnsPage,
  loader: loader$9
}, Symbol.toStringTag, { value: 'Module' }));

const action$5 = async ({ request }) => {
  try {
    const { topic, shop, session, admin } = await shopify.authenticate.webhook(request);
    const payload = await request.json();
    console.log(`[webhook] Received ${topic} for ${shop}`);
    switch (topic) {
      case "APP_UNINSTALLED": {
        await prisma$1.shop.updateMany({
          where: { shop },
          data: { uninstalledAt: /* @__PURE__ */ new Date() }
        });
        console.log(`[webhook] Shop uninstalled: ${shop}`);
        break;
      }
      case "ORDERS_FULFILLED": {
        const orderId = payload.id;
        const orderName = payload.name || `#${orderId}`;
        const customerEmail = payload.email || payload.contact_email || "";
        const customerName = payload.customer ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() : "";
        const lineItems = (payload.line_items || []).map((item) => ({
          variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
          title: item.title,
          quantity: item.quantity,
          price: item.price || "0",
          sku: item.sku || ""
        }));
        const existing = await prisma$1.returnRequest.findFirst({
          where: { shop, orderId: `gid://shopify/Order/${orderId}` }
        });
        if (existing) {
          console.log(`[webhook] Return already exists for order ${orderName}, skipping`);
          break;
        }
        await prisma$1.returnRequest.create({
          data: {
            shop,
            orderId: `gid://shopify/Order/${orderId}`,
            orderName,
            customerEmail,
            customerName,
            items: lineItems,
            status: "PENDING"
          }
        });
        console.log(`[webhook] Created return for order ${orderName} (${lineItems.length} items)`);
        break;
      }
      case "CUSTOMERS_DATA_REQUEST":
      case "PRIVACY_REDACT": {
        console.log(`[webhook] GDPR ${topic} for ${shop}`);
        break;
      }
      default:
        console.log(`[webhook] Unhandled topic: ${topic}`);
    }
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`[webhook] Error:`, error.message);
    return new Response(error.message, { status: 401 });
  }
};

const route2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$5
}, Symbol.toStringTag, { value: 'Module' }));

const STATUS_COLORS = {
  PENDING: "warning",
  APPROVED: "success",
  DENIED: "critical",
  EXCHANGE: "info",
  SHIPPED: "info",
  REFUNDED: "success",
  CLOSED: "new"
};
const loader$8 = async ({ request, params }) => {
  const { session } = await shopify.authenticate.admin(request);
  const returnReq = await prisma$1.returnRequest.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      fraudSignals: true,
      decisionLogs: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!returnReq) throw new Response("Not found", { status: 404 });
  return json({ return: returnReq });
};
function ReturnDetailPage() {
  const { return: r } = useLoaderData();
  const items = r.items;
  const logs = r.decisionLogs;
  return /* @__PURE__ */ jsx(
    Page,
    {
      title: `Return ${r.orderName || r.id.slice(0, 8)}`,
      backAction: { url: "/returns" },
      children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
          /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
            /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Status" }),
              /* @__PURE__ */ jsx(Badge, { tone: STATUS_COLORS[r.status] || "info", children: r.status })
            ] }),
            r.status === "PENDING" && /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
              /* @__PURE__ */ jsx(Button, { tone: "critical", children: "Deny" }),
              /* @__PURE__ */ jsx(Button, { variant: "primary", tone: "success", children: "Approve" })
            ] })
          ] }),
          r.customerName && /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Customer:" }),
            " ",
            r.customerName,
            " ",
            r.customerEmail && `(${r.customerEmail})`
          ] }),
          r.reason && /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Reason:" }),
            " ",
            r.reason
          ] }),
          r.notes && /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Notes:" }),
            " ",
            r.notes
          ] }),
          /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
            "Created: ",
            new Date(r.createdAt).toLocaleString()
          ] })
        ] }) }),
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsxs(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: [
            "Items (",
            items.length,
            ")"
          ] }),
          items.map((item, i) => /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "span", fontWeight: "bold", children: item.title }),
              /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "span", children: [
                "x",
                item.quantity,
                " ",
                item.price && `$${item.price}`
              ] })
            ] }),
            item.sku && /* @__PURE__ */ jsx(Tag, { children: item.sku }),
            item.reason && /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
              "Reason: ",
              item.reason
            ] })
          ] }, i))
        ] }) }),
        r.fraudSignals.length > 0 && /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Fraud Signals" }),
          r.fraudSignals.map((s) => /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(Badge, { tone: s.score > 0.5 ? "critical" : "warning", children: [
              (s.score * 100).toFixed(0),
              "%"
            ] }),
            /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "span", children: s.signal })
          ] }, s.id))
        ] }) }),
        logs.length > 0 && /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Activity Log" }),
          logs.map((log) => /* @__PURE__ */ jsx(BlockStack, { gap: "100", children: /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", fontWeight: "bold", children: log.actor }),
            /* @__PURE__ */ jsx(Tag, { children: log.action }),
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: new Date(log.createdAt).toLocaleString() })
          ] }) }, log.id))
        ] }) })
      ] }) }) })
    }
  );
}

const route3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: ReturnDetailPage,
  loader: loader$8
}, Symbol.toStringTag, { value: 'Module' }));

const loader$7 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  try {
    await registerWebhooks({ session });
  } catch (error) {
    console.log(`[auth] Webhook registration: ${error}`);
  }
  return null;
};

const route4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  loader: loader$7
}, Symbol.toStringTag, { value: 'Module' }));

const loader$6 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = session.shop;
  const totalReturns = await prisma$1.returnRequest.count({ where: { shop } });
  const statusCounts = await prisma$1.returnRequest.groupBy({
    by: ["status"],
    where: { shop },
    _count: true
  });
  const statusMap = {};
  statusCounts.forEach((s) => {
    statusMap[s.status] = s._count;
  });
  const refundAgg = await prisma$1.returnRequest.aggregate({
    where: { shop, status: "REFUNDED" },
    _sum: { refundAmount: true }
  });
  const totalRefunded = refundAgg._sum.refundAmount || 0;
  const autoApproved = await prisma$1.returnRequest.count({
    where: { shop, decidedBy: "agent" }
  });
  const decidedReturns = await prisma$1.returnRequest.findMany({
    where: { shop, decidedAt: { not: null } },
    select: { createdAt: true, decidedAt: true }
  });
  let avgResolutionHours = 0;
  if (decidedReturns.length > 0) {
    const totalHours = decidedReturns.reduce((sum, r) => {
      const diff = (new Date(r.decidedAt).getTime() - new Date(r.createdAt).getTime()) / (1e3 * 60 * 60);
      return sum + diff;
    }, 0);
    avgResolutionHours = Math.round(totalHours / decidedReturns.length);
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const recentReturns = await prisma$1.returnRequest.findMany({
    where: { shop, createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, status: true, refundAmount: true }
  });
  const dailyCounts = {};
  recentReturns.forEach((r) => {
    const day = new Date(r.createdAt).toISOString().slice(0, 10);
    if (!dailyCounts[day]) dailyCounts[day] = { total: 0, approved: 0, refunded: 0, amount: 0 };
    dailyCounts[day].total++;
    if (r.status === "APPROVED" || r.status === "REFUNDED") dailyCounts[day].approved++;
    if (r.status === "REFUNDED") {
      dailyCounts[day].refunded++;
      dailyCounts[day].amount += parseFloat(String(r.refundAmount || 0));
    }
  });
  const dailyData = Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const fraudCount = await prisma$1.fraudSignal.count({
    where: { return: { shop } }
  });
  const highRiskFraud = await prisma$1.fraudSignal.count({
    where: { return: { shop }, score: { gte: 0.5 } }
  });
  const allReturns = await prisma$1.returnRequest.findMany({
    where: { shop, reason: { not: null } },
    select: { reason: true }
  });
  const reasonCounts = {};
  allReturns.forEach((r) => {
    const reason = r.reason?.toLowerCase().trim() || "other";
    const key = reason.includes("fit") || reason.includes("size") ? "Sizing issue" : reason.includes("defect") || reason.includes("broken") || reason.includes("damage") ? "Defective" : reason.includes("color") || reason.includes("photo") || reason.includes("look") ? "Not as described" : reason.includes("change") || reason.includes("mind") ? "Changed mind" : reason.includes("quality") ? "Quality issue" : reason.includes("duplicate") ? "Duplicate order" : reason.includes("wrong") ? "Wrong item sent" : "Other";
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  const items = allReturns.length > 0 ? await prisma$1.returnRequest.findMany({
    where: { shop },
    select: { items: true }
  }) : [];
  const productCounts = {};
  const productRevenue = {};
  items.forEach((r) => {
    const productItems = r.items;
    productItems.forEach((item) => {
      const title = item.title || "Unknown";
      productCounts[title] = (productCounts[title] || 0) + (item.quantity || 1);
      productRevenue[title] = (productRevenue[title] || 0) + parseFloat(item.price || "0") * (item.quantity || 1);
    });
  });
  const topProducts = Object.entries(productCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count, revenue: productRevenue[name] || 0 }));
  return json({
    stats: {
      totalReturns,
      pending: statusMap.PENDING || 0,
      approved: statusMap.APPROVED || 0,
      denied: statusMap.DENIED || 0,
      refunded: statusMap.REFUNDED || 0,
      exchange: statusMap.EXCHANGE || 0,
      totalRefunded: Number(totalRefunded),
      autoApproved,
      autoRate: totalReturns > 0 ? Math.round(autoApproved / totalReturns * 100) : 0,
      avgResolutionHours,
      fraudCount,
      highRiskFraud
    },
    dailyData,
    topReasons: topReasons.map(([reason, count]) => ({ reason, count })),
    topProducts
  });
};
function StatCard({ label, value, tone, prefix, suffix }) {
  return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
    /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "subdued", children: label }),
    /* @__PURE__ */ jsxs(Text, { variant: "headingXl", as: "p", fontWeight: "bold", tone, children: [
      prefix,
      typeof value === "number" ? value.toLocaleString() : value,
      suffix
    ] })
  ] }) });
}
function MiniBar({ value, max, label, color }) {
  const pct = max > 0 ? value / max * 100 : 0;
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: 8 }, children: [
    /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
      /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", children: label }),
      /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", fontWeight: "bold", children: value })
    ] }),
    /* @__PURE__ */ jsx("div", { style: {
      height: 8,
      background: "#e0e0e0",
      borderRadius: 4,
      overflow: "hidden"
    }, children: /* @__PURE__ */ jsx("div", { style: {
      width: `${pct}%`,
      height: "100%",
      background: color || "#5c6ac4",
      borderRadius: 4,
      transition: "width 0.3s"
    } }) })
  ] });
}
function AnalyticsPage() {
  const { stats, dailyData, topReasons, topProducts } = useLoaderData();
  const maxDaily = Math.max(...dailyData.map((d) => d[1].total), 1);
  return /* @__PURE__ */ jsx(Page, { title: "Analytics", subtitle: "Return performance overview", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }, children: [
      /* @__PURE__ */ jsx(StatCard, { label: "Total Returns", value: stats.totalReturns }),
      /* @__PURE__ */ jsx(StatCard, { label: "Pending", value: stats.pending, tone: "warning" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Approved", value: stats.approved, tone: "success" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Denied", value: stats.denied, tone: "critical" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Refunded", value: stats.refunded }),
      /* @__PURE__ */ jsx(StatCard, { label: "Total Refunded", value: stats.totalRefunded, prefix: "$" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }, children: [
      /* @__PURE__ */ jsx(StatCard, { label: "Auto-Resolution Rate", value: stats.autoRate, suffix: "%", tone: stats.autoRate > 50 ? "success" : "warning" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Avg Resolution Time", value: stats.avgResolutionHours, suffix: "h" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Fraud Signals Detected", value: stats.fraudCount, tone: stats.fraudCount > 0 ? "warning" : void 0 }),
      /* @__PURE__ */ jsx(StatCard, { label: "High Risk Alerts", value: stats.highRiskFraud, tone: stats.highRiskFraud > 0 ? "critical" : void 0 })
    ] }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Returns Trend (Last 14 Days)" }),
      dailyData.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "No data for the last 14 days." }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 4, alignItems: "flex-end", height: 120, padding: "8px 0" }, children: dailyData.map(([day, data]) => /* @__PURE__ */ jsxs("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          width: "100%",
          maxWidth: 40,
          height: `${data.total / maxDaily * 100}%`,
          background: "#5c6ac4",
          borderRadius: "4px 4px 0 0",
          minHeight: data.total > 0 ? 4 : 0,
          position: "relative"
        }, children: data.total > 0 && /* @__PURE__ */ jsx(Text, { variant: "bodyXs", as: "span", style: {
          position: "absolute",
          top: -16,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10
        }, children: data.total }) }),
        /* @__PURE__ */ jsx(Text, { variant: "bodyXs", as: "span", tone: "subdued", style: { fontSize: 9, marginTop: 4 }, children: day.slice(5) })
      ] }, day)) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Top Return Reasons" }),
        topReasons.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "No data yet." }) : topReasons.map(({ reason, count }) => /* @__PURE__ */ jsx(
          MiniBar,
          {
            label: reason,
            value: count,
            max: topReasons[0]?.count || 1,
            color: "#ecc134"
          },
          reason
        ))
      ] }) }),
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Most Returned Products" }),
        topProducts.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "No data yet." }) : topProducts.map(({ name, count, revenue }) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
            /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", children: name }),
            /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "span", fontWeight: "bold", children: [
              "x",
              count
            ] })
          ] }),
          /* @__PURE__ */ jsxs(Text, { variant: "bodyXs", as: "p", tone: "subdued", children: [
            "$",
            revenue.toFixed(2),
            " returned value"
          ] })
        ] }, name))
      ] }) })
    ] })
  ] }) }) }) });
}

const route5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: AnalyticsPage,
  loader: loader$6
}, Symbol.toStringTag, { value: 'Module' }));

function FormField({
  label,
  name,
  type,
  value,
  onChange,
  ...rest
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name, value }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        label,
        type,
        value,
        onChange,
        autoComplete: "off",
        ...rest
      }
    )
  ] });
}
const loader$5 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const policies = await prisma$1.policy.findMany({
    where: { shop: session.shop },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
  });
  return json({ policies });
};
const action$4 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");
  if (_action === "create" || _action === "update") {
    const id = formData.get("id");
    const name = formData.get("name");
    const description = formData.get("description");
    const priority = parseInt(formData.get("priority")) || 0;
    const isActive = formData.get("isActive") === "true";
    const conditions = [
      { field: "maxDays", operator: "lte", value: parseInt(formData.get("maxDays")) || 30 },
      { field: "maxAmount", operator: "lte", value: parseFloat(formData.get("maxAmount")) || 9999 },
      { field: "autoApprove", operator: "eq", value: formData.get("autoApprove") === "true" },
      { field: "restockingFee", operator: "eq", value: parseFloat(formData.get("restockingFee")) || 0 },
      { field: "requiresReturnLabel", operator: "eq", value: formData.get("requiresReturnLabel") === "true" }
    ];
    if (_action === "create") {
      await prisma$1.policy.create({
        data: { shop: session.shop, name, description, priority, isActive, conditions }
      });
    } else if (id) {
      await prisma$1.policy.update({
        where: { id },
        data: { name, description, priority, isActive, conditions }
      });
    }
  } else if (_action === "delete") {
    await prisma$1.policy.delete({ where: { id: formData.get("id") } });
  } else if (_action === "toggle") {
    const id = formData.get("id");
    const policy = await prisma$1.policy.findUnique({ where: { id } });
    if (policy) {
      await prisma$1.policy.update({ where: { id }, data: { isActive: !policy.isActive } });
    }
  }
  return json({ ok: true });
};
function getCond(conditions, field) {
  return conditions.find((c) => c.field === field);
}
const emptyForm = () => ({
  name: "",
  description: "",
  priority: "0",
  maxDays: "30",
  maxAmount: "200",
  autoApprove: false,
  restockingFee: "0",
  requiresReturnLabel: false
});
function PoliciesPage() {
  const { policies } = useLoaderData();
  const fetcher = useFetcher();
  const [active, setActive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [f, setF] = useState(emptyForm());
  const isNew = !editingId;
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setActive(false);
      setEditingId(null);
    }
  }, [fetcher.state, fetcher.data]);
  const openNew = () => {
    setEditingId(null);
    setF(emptyForm());
    setActive(true);
  };
  const openEdit = (p) => {
    const c = p.conditions;
    setEditingId(p.id);
    setF({
      name: p.name,
      description: p.description || "",
      priority: String(p.priority),
      maxDays: String(getCond(c, "maxDays")?.value ?? 30),
      maxAmount: String(getCond(c, "maxAmount")?.value ?? 200),
      autoApprove: getCond(c, "autoApprove")?.value === true,
      restockingFee: String(getCond(c, "restockingFee")?.value ?? 0),
      requiresReturnLabel: getCond(c, "requiresReturnLabel")?.value === true
    });
    setActive(true);
  };
  const closeModal = () => {
    setActive(false);
    setEditingId(null);
  };
  const u = (field) => (val) => setF((prev) => ({ ...prev, [field]: val }));
  return /* @__PURE__ */ jsxs(
    Page,
    {
      title: "Return Policies",
      primaryAction: { content: "Add Policy", onAction: openNew },
      children: [
        /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: policies.length === 0 ? /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "No policies yet. Create your first return policy to start automating return decisions." }) }) : policies.map((p) => {
          const c = p.conditions;
          const autoApprove = getCond(c, "autoApprove")?.value;
          const fee = getCond(c, "restockingFee")?.value ?? 0;
          return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", wrap: false, children: [
              /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h3", fontWeight: "bold", children: p.name }),
                p.description && /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "p", tone: "subdued", children: p.description })
              ] }),
              /* @__PURE__ */ jsxs(InlineStack, { gap: "200", align: "end", children: [
                /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => {
                  fetcher.submit({ _action: "toggle", id: p.id }, { method: "post" });
                }, children: p.isActive ? "Disable" : "Enable" }),
                /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => openEdit(p), children: "Edit" }),
                /* @__PURE__ */ jsx(Button, { size: "slim", tone: "critical", onClick: () => {
                  fetcher.submit({ _action: "delete", id: p.id }, { method: "post" });
                }, children: "Delete" })
              ] })
            ] }),
            !p.isActive && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: "This policy is disabled" }),
            /* @__PURE__ */ jsxs(InlineStack, { gap: "200", wrap: true, children: [
              /* @__PURE__ */ jsxs(Tag, { tone: "info", children: [
                "Priority ",
                p.priority
              ] }),
              /* @__PURE__ */ jsxs(Tag, { tone: "info", children: [
                "≤",
                getCond(c, "maxDays")?.value ?? 30,
                " days"
              ] }),
              /* @__PURE__ */ jsxs(Tag, { tone: "info", children: [
                "≤ $",
                getCond(c, "maxAmount")?.value ?? 200
              ] }),
              autoApprove && /* @__PURE__ */ jsx(Tag, { tone: "success", children: "Auto-approve" }),
              Number(fee) > 0 && /* @__PURE__ */ jsxs(Tag, { tone: "warning", children: [
                fee,
                "% restocking fee"
              ] })
            ] })
          ] }) }, p.id);
        }) }) }),
        /* @__PURE__ */ jsx(Modal, { open: active, onClose: closeModal, title: isNew ? "Create Policy" : "Edit Policy", children: /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", id: "policy-form", children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: isNew ? "create" : "update" }),
          !isNew && /* @__PURE__ */ jsx("input", { type: "hidden", name: "id", value: editingId }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "isActive", value: "true" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "autoApprove", value: String(f.autoApprove) }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "requiresReturnLabel", value: String(f.requiresReturnLabel) }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(FormField, { label: "Policy Name", name: "name", value: f.name, onChange: u("name"), required: true }),
            /* @__PURE__ */ jsx(FormField, { label: "Description", name: "description", value: f.description, onChange: u("description"), multiline: 2 }),
            /* @__PURE__ */ jsx(FormField, { label: "Priority (lower = checked first)", name: "priority", type: "number", value: f.priority, onChange: u("priority") }),
            /* @__PURE__ */ jsx(FormField, { label: "Max Days for Return", name: "maxDays", type: "number", value: f.maxDays, onChange: u("maxDays") }),
            /* @__PURE__ */ jsx(FormField, { label: "Max Amount for Auto-approve ($)", name: "maxAmount", type: "number", prefix: "$", step: "0.01", value: f.maxAmount, onChange: u("maxAmount") }),
            /* @__PURE__ */ jsx(
              Checkbox,
              {
                label: "Auto-approve returns matching this policy",
                checked: f.autoApprove,
                onChange: u("autoApprove")
              }
            ),
            /* @__PURE__ */ jsx(FormField, { label: "Restocking Fee (%)", name: "restockingFee", type: "number", suffix: "%", step: "0.5", value: f.restockingFee, onChange: u("restockingFee") }),
            /* @__PURE__ */ jsx(
              Checkbox,
              {
                label: "Require return label",
                checked: f.requiresReturnLabel,
                onChange: u("requiresReturnLabel")
              }
            ),
            /* @__PURE__ */ jsx(
              Button,
              {
                onClick: () => {
                  const form = document.querySelector("#policy-form");
                  if (form) fetcher.submit(form);
                },
                variant: "primary",
                children: isNew ? "Create Policy" : "Update Policy"
              }
            )
          ] })
        ] }) }) })
      ]
    }
  );
}

const route6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: PoliciesPage,
  loader: loader$5
}, Symbol.toStringTag, { value: 'Module' }));

const loader$4 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shop = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
  const config = shop?.config || {};
  return json({
    hasMcpKey: !!shop?.mcpApiKeyHash,
    labelConfig: {
      provider: config.labelProvider || "",
      sendcloudKey: config.sendcloudKey ? "***" : "",
      sendcloudSecret: config.sendcloudSecret ? "***" : "",
      shippoKey: config.shippoKey ? "***" : "",
      easypostKey: config.easypostKey ? "***" : ""
    }
  });
};
const action$3 = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const _action = formData.get("_action");
  if (_action === "generate_key") {
    const key = "shpg_returns_" + [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    await prisma$1.shop.upsert({
      where: { shop: session.shop },
      create: { id: session.shop, shop: session.shop, mcpApiKeyHash: hash },
      update: { mcpApiKeyHash: hash }
    });
    return json({ newKey: key });
  }
  if (_action === "save_labels") {
    const shopRec = await prisma$1.shop.findUnique({ where: { shop: session.shop } });
    const currentConfig = shopRec?.config || {};
    const provider = formData.get("provider");
    const sendcloudKey = formData.get("sendcloudKey");
    const sendcloudSecret = formData.get("sendcloudSecret");
    const shippoKey = formData.get("shippoKey");
    const easypostKey = formData.get("easypostKey");
    await prisma$1.shop.update({
      where: { shop: session.shop },
      data: {
        config: {
          ...currentConfig,
          labelProvider: provider,
          // Only update if a new value is provided (not masked "***")
          ...sendcloudKey && sendcloudKey !== "***" ? { sendcloudKey } : {},
          ...sendcloudSecret && sendcloudSecret !== "***" ? { sendcloudSecret } : {},
          ...shippoKey && shippoKey !== "***" ? { shippoKey } : {},
          ...easypostKey && easypostKey !== "***" ? { easypostKey } : {}
        }
      }
    });
    return json({ saved: true });
  }
  return json({ ok: true });
};
function SettingsPage() {
  const { hasMcpKey, labelConfig } = useLoaderData();
  const fetcher = useFetcher();
  const [copied, setCopied] = useState(false);
  const newKey = fetcher.data?.newKey;
  const saved = fetcher.data?.saved;
  const [provider, setProvider] = useState(labelConfig.provider || "sendcloud");
  const [scKey, setScKey] = useState(labelConfig.sendcloudKey);
  const [scSecret, setScSecret] = useState(labelConfig.sendcloudSecret);
  const [shKey, setShKey] = useState(labelConfig.shippoKey);
  const [epKey, setEpKey] = useState(labelConfig.easypostKey);
  return /* @__PURE__ */ jsx(Page, { title: "Settings", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsxs(Layout.Section, { children: [
    saved && /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Label provider settings saved!" }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "MCP Server" }),
      /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
        "Endpoint: ",
        /* @__PURE__ */ jsx("code", { children: "https://returns-app-production-8384.up.railway.app/api/mcp" })
      ] }) }),
      newKey ? /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Banner, { tone: "critical", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Save this key now — it will not be shown again!" }) }),
        /* @__PURE__ */ jsx("div", { style: { background: "#1a1a2e", color: "#fff", padding: 12, borderRadius: 6, fontFamily: "monospace", wordBreak: "break-all" }, children: newKey }),
        /* @__PURE__ */ jsx(Button, { onClick: () => {
          navigator.clipboard.writeText(newKey);
          setCopied(true);
        }, children: copied ? "Copied!" : "Copy to clipboard" })
      ] }) : /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: hasMcpKey ? "An MCP key exists. Generate a new one to replace it." : "No MCP key yet. Generate one for AI agent access." }),
        /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: () => fetcher.submit({ _action: "generate_key" }, { method: "post" }), children: hasMcpKey ? "Regenerate Key" : "Generate MCP Key" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Label Provider" }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Choose your shipping provider and enter your API credentials. The AI agent will generate return labels automatically." }),
      /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "save_labels" }),
        /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
          /* @__PURE__ */ jsx(
            Select,
            {
              label: "Provider",
              name: "provider",
              value: provider,
              onChange: setProvider,
              options: [
                { label: "SendCloud (EU/NL — PostNL, DHL, DPD)", value: "sendcloud" },
                { label: "Shippo (US/Global — UPS, FedEx, USPS)", value: "shippo" },
                { label: "EasyPost (Global — UPS, FedEx, DHL, DPD)", value: "easypost" }
              ]
            }
          ),
          provider === "sendcloud" && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(TextField, { label: "SendCloud API Key", name: "sendcloudKey", value: scKey, onChange: setScKey, autoComplete: "off", placeholder: scKey === "***" ? "•••••••• (saved)" : "Enter your API key" }),
            /* @__PURE__ */ jsx(TextField, { label: "SendCloud API Secret", name: "sendcloudSecret", type: "password", value: scSecret, onChange: setScSecret, autoComplete: "off", placeholder: scSecret === "***" ? "•••••••• (saved)" : "Enter your API secret" })
          ] }),
          provider === "shippo" && /* @__PURE__ */ jsx(TextField, { label: "Shippo API Key", name: "shippoKey", value: shKey, onChange: setShKey, autoComplete: "off", placeholder: shKey === "***" ? "•••••••• (saved)" : "Enter your API key" }),
          provider === "easypost" && /* @__PURE__ */ jsx(TextField, { label: "EasyPost API Key", name: "easypostKey", value: epKey, onChange: setEpKey, autoComplete: "off", placeholder: epKey === "***" ? "•••••••• (saved)" : "Enter your API key" }),
          /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", children: "Save Provider Settings" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: "Email" }),
      /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Email notifications active via VPS mail relay. Customers receive automatic emails on approve/deny/refund." }) })
    ] }) })
  ] }) }) });
}

const route7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: SettingsPage,
  loader: loader$4
}, Symbol.toStringTag, { value: 'Module' }));

const SHOPIFY_API_VERSION = "2024-10";
async function shopifyAdminQuery(shop, accessToken, query, variables) {
  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables })
    }
  );
  return response.json();
}
async function executeRefund(shop, accessToken, orderId, amount, restock = true, reason = "Customer return") {
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
  const calculateMutation = `mutation calculate($input: CalculateRefundInput!) {
    calculateRefund(input: $input) {
      refund {
        id
        transactions {
          id
          amountSet { shopMoney { amount } }
          kind
        }
        orderAdjustments {
          id
          amountSet { shopMoney { amount } }
          reason
        }
      }
      userErrors { field message }
    }
  }`;
  const calculateResult = await shopifyAdminQuery(shop, accessToken, calculateMutation, {
    input: {
      orderId: orderGid,
      amount: { amount, currencyCode: "USD" },
      refundLineItems: [],
      restock
    }
  });
  const errors = calculateResult?.data?.calculateRefund?.userErrors;
  if (errors?.length > 0) {
    throw new Error(`Refund calculation failed: ${errors.map((e) => e.message).join(", ")}`);
  }
  const calculatedRefund = calculateResult?.data?.calculateRefund?.refund;
  if (!calculatedRefund) {
    throw new Error("Failed to calculate refund");
  }
  const executeMutation = `mutation execute($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        transactions {
          id
          status
          processedAt
          amountSet { shopMoney { amount } }
        }
      }
      userErrors { field message }
    }
  }`;
  const executeResult = await shopifyAdminQuery(shop, accessToken, executeMutation, {
    input: {
      orderId: orderGid,
      amount: { amount, currencyCode: "USD" },
      restock,
      note: reason,
      transactions: calculatedRefund.transactions?.map((t) => ({
        id: t.id,
        amount: { amount, currencyCode: "USD" },
        kind: "refund",
        gateway: t.id
      })),
      refundLineItems: []
    }
  });
  const execErrors = executeResult?.data?.refundCreate?.userErrors;
  if (execErrors?.length > 0) {
    throw new Error(`Refund execution failed: ${execErrors.map((e) => e.message).join(", ")}`);
  }
  return executeResult?.data?.refundCreate?.refund;
}

const RELAY_URL = process.env.MAIL_RELAY_URL || "http://localhost:8787/send";
const RELAY_KEY = process.env.MAIL_RELAY_KEY || "";
process.env.EMAIL_FROM || "Shopigent Returns <returns@shopigent.com>";
async function sendEmail(payload) {
  if (!RELAY_KEY) {
    console.log("[email] No MAIL_RELAY_KEY configured, skipping");
    return false;
  }
  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-key": RELAY_KEY
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        text: payload.html.replace(/<[^>]*>/g, ""),
        // strip HTML for plain text fallback
        html: payload.html
      }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      console.error(`[email] Relay failed: ${response.status}`);
      return false;
    }
    console.log(`[email] Sent to ${payload.to}: ${payload.subject}`);
    return true;
  } catch (err) {
    console.error(`[email] Error: ${err.message}`);
    return false;
  }
}
function returnApprovedEmail(customerName, orderName, refundAmount) {
  const refundLine = refundAmount ? `<p>Refund amount: <strong>$${refundAmount.toFixed(2)}</strong></p>` : "";
  return {
    to: "",
    subject: `Return Approved — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#50b83c">✅ Return Approved</h2>
      <p>Hi ${customerName},</p>
      <p>Your return for order <strong>${orderName}</strong> has been approved!</p>
      ${refundLine}
      <p>Your refund will be processed within 3-5 business days.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}
function returnDeniedEmail(customerName, orderName, reason) {
  return {
    to: "",
    subject: `Return Update — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#de3617">Return Update</h2>
      <p>Hi ${customerName},</p>
      <p>After reviewing your return request for order <strong>${orderName}</strong>, we're unable to approve it.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you have questions, please contact support.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}
function refundProcessedEmail(customerName, orderName, amount) {
  return {
    to: "",
    subject: `Refund Processed — ${orderName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#47c1bf">💰 Refund Processed</h2>
      <p>Hi ${customerName},</p>
      <p>Your refund of <strong>$${amount.toFixed(2)}</strong> for order <strong>${orderName}</strong> has been processed.</p>
      <p>The refund will appear on your payment method within 3-5 business days.</p>
      <hr><p style="color:#666;font-size:12px">Shopigent Returns — AI-powered return management</p>
    </div>`
  };
}

async function getLabelConfig(shop) {
  const shopRec = await prisma$1.shop.findUnique({ where: { shop } });
  const dbConfig = shopRec?.config || {};
  return {
    provider: dbConfig.labelProvider || process.env.LABEL_PROVIDER || "sendcloud",
    sendcloudKey: dbConfig.sendcloudKey || process.env.SENDCLOUD_API_KEY || "",
    sendcloudSecret: dbConfig.sendcloudSecret || process.env.SENDCLOUD_API_SECRET || "",
    shippoKey: dbConfig.shippoKey || process.env.SHIPPO_API_KEY || "",
    easypostKey: dbConfig.easypostKey || process.env.EASYPOST_API_KEY || "",
    shopAddress: dbConfig.shopAddress || {
      line1: process.env.SHOP_ADDRESS_LINE1 || "",
      city: process.env.SHOP_ADDRESS_CITY || "",
      postalCode: process.env.SHOP_ADDRESS_ZIP || "",
      country: process.env.SHOP_ADDRESS_COUNTRY || "NL"
    }
  };
}
async function createReturnLabel(shop, request) {
  const config = await getLabelConfig(shop);
  switch (config.provider) {
    case "sendcloud":
      return createSendCloudLabel(request, config.sendcloudKey, config.sendcloudSecret);
    case "shippo":
      return createShippoLabel(request, config.shippoKey);
    case "easypost":
      return createEasyPostLabel(request, config.easypostKey);
    default:
      return { success: false, error: `Unknown label provider: ${config.provider}` };
  }
}
async function createSendCloudLabel(req, apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    return { success: false, error: "SendCloud not configured (SENDCLOUD_API_KEY + SENDCLOUD_API_SECRET)" };
  }
  try {
    const response = await fetch("https://panel.sendcloud.sc/api/v2/labels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")
      },
      body: JSON.stringify({
        label: {
          order_number: req.orderName,
          order_id: req.orderName,
          name: req.customerName,
          email: req.customerEmail,
          telephone: req.customerPhone || "",
          address: req.customerAddress?.line1 || req.shopAddress.line1,
          address_2: req.customerAddress?.line2 || req.shopAddress.line2 || "",
          city: req.customerAddress?.city || req.shopAddress.city,
          postal_code: req.customerAddress?.postalCode || req.shopAddress.postalCode,
          country: req.customerAddress?.country || req.shopAddress.country,
          to_service_point: false,
          parcel_items: req.items.map((item) => ({
            description: item.title,
            quantity: item.quantity,
            weight: (req.weight || 1) / req.items.length,
            value: 0
          })),
          request_label: true,
          label_format: "pdf"
        }
      })
    });
    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `SendCloud error: ${response.status} ${err}` };
    }
    const data = await response.json();
    const label = data.label || data;
    return {
      success: true,
      labelUrl: label.label_printer_url || label.label_url,
      trackingNumber: label.tracking_number,
      labelId: String(label.id),
      cost: label.total_price ? parseFloat(label.total_price) : void 0
    };
  } catch (err) {
    return { success: false, error: `SendCloud error: ${err.message}` };
  }
}
async function createShippoLabel(req, apiKey) {
  if (!apiKey) {
    return { success: false, error: "Shippo not configured (SHIPPO_API_KEY)" };
  }
  try {
    const shipmentResp = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ShippoToken ${apiKey}`
      },
      body: JSON.stringify({
        address_from: {
          name: "Returns",
          street1: req.shopAddress.line1,
          street2: req.shopAddress.line2 || "",
          city: req.shopAddress.city,
          state: req.shopAddress.state || "",
          zip: req.shopAddress.postalCode,
          country: req.shopAddress.country
        },
        address_to: {
          name: req.customerName,
          street1: req.customerAddress?.line1 || req.shopAddress.line1,
          street2: req.customerAddress?.line2 || "",
          city: req.customerAddress?.city || req.shopAddress.city,
          state: req.customerAddress?.state || "",
          zip: req.customerAddress?.postalCode || req.shopAddress.postalCode,
          country: req.customerAddress?.country || req.shopAddress.country
        },
        parcels: [{
          length: "30",
          width: "20",
          height: "10",
          distance_unit: "cm",
          weight: String(req.weight || 1),
          mass_unit: "kg"
        }],
        async: false
      })
    });
    if (!shipmentResp.ok) {
      return { success: false, error: `Shippo shipment failed: ${await shipmentResp.text()}` };
    }
    const shipment = await shipmentResp.json();
    if (!shipment.rates?.length) {
      return { success: false, error: "No shipping rates available" };
    }
    const rateId = shipment.rates[0].object_id;
    const labelResp = await fetch("https://api.goshippo.com/transactions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ShippoToken ${apiKey}`
      },
      body: JSON.stringify({
        rate: rateId,
        label_file_type: "PDF",
        async: false
      })
    });
    if (!labelResp.ok) {
      return { success: false, error: `Shippo label failed: ${await labelResp.text()}` };
    }
    const label = await labelResp.json();
    return {
      success: true,
      labelUrl: label.label_url,
      trackingNumber: label.tracking_number,
      labelId: label.object_id,
      cost: label.amount ? parseFloat(label.amount) : void 0
    };
  } catch (err) {
    return { success: false, error: `Shippo error: ${err.message}` };
  }
}
async function createEasyPostLabel(req, apiKey) {
  if (!apiKey) {
    return { success: false, error: "EasyPost not configured (EASYPOST_API_KEY)" };
  }
  try {
    const shipmentResp = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        shipment: {
          from_address: {
            street1: req.shopAddress.line1,
            street2: req.shopAddress.line2 || "",
            city: req.shopAddress.city,
            state: req.shopAddress.state || "",
            zip: req.shopAddress.postalCode,
            country: req.shopAddress.country
          },
          to_address: {
            name: req.customerName,
            street1: req.customerAddress?.line1 || req.shopAddress.line1,
            street2: req.customerAddress?.line2 || "",
            city: req.customerAddress?.city || req.shopAddress.city,
            state: req.customerAddress?.state || "",
            zip: req.customerAddress?.postalCode || req.shopAddress.postalCode,
            country: req.customerAddress?.country || req.shopAddress.country
          },
          parcel: {
            length: 30,
            width: 20,
            height: 10,
            weight: req.weight || 1
          }
        }
      })
    });
    if (!shipmentResp.ok) {
      return { success: false, error: `EasyPost shipment failed: ${await shipmentResp.text()}` };
    }
    const shipment = await shipmentResp.json();
    if (!shipment.rates?.length) {
      return { success: false, error: "No shipping rates available" };
    }
    const rate = shipment.rates.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))[0];
    const buyResp = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ rate: { id: rate.id } })
    });
    if (!buyResp.ok) {
      return { success: false, error: `EasyPost buy failed: ${await buyResp.text()}` };
    }
    const bought = await buyResp.json();
    return {
      success: true,
      labelUrl: bought.postage_label?.label_url,
      trackingNumber: bought.tracking_code,
      labelId: bought.id,
      cost: parseFloat(rate.rate)
    };
  } catch (err) {
    return { success: false, error: `EasyPost error: ${err.message}` };
  }
}

const RETURNS_TOOLS = [
  {
    name: "analyze_return",
    description: "Analyze a return request against store policies and fraud signals. Returns a recommendation (approve/deny/exchange) with confidence score.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "approve_return",
    description: "Approve a pending return request. Optionally set refund amount and issue a return label.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        refundAmount: { type: "number", description: "Optional override refund amount" },
        issueLabel: { type: "boolean", description: "Whether to generate a return label" },
        notes: { type: "string", description: "Notes about the decision" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "deny_return",
    description: "Deny a pending return request with a reason.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" },
        reason: { type: "string", description: "Reason for denial" }
      },
      required: ["returnId", "reason"]
    }
  },
  {
    name: "check_fraud",
    description: "Run fraud detection signals on a return request. Checks IP velocity, history patterns, amount anomalies.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "list_policies",
    description: "List all active return policies for the store.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_policy_recommendation",
    description: "Get a policy-based recommendation for a return request. Evaluates against all active policies and returns the best match.",
    inputSchema: {
      type: "object",
      properties: {
        returnId: { type: "string", description: "The return request UUID" }
      },
      required: ["returnId"]
    }
  },
  {
    name: "list_returns",
    description: "List return requests, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: PENDING, APPROVED, DENIED, EXCHANGE, SHIPPED, REFUNDED, CLOSED" },
        limit: { type: "number", description: "Max results (default 10)" }
      }
    }
  }
];

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
async function handleMcpRequest(body) {
  const { method, id, params } = body;
  switch (method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "shopigent-returns", version: "0.1.0" }
      });
    case "tools/list":
      return jsonRpcResult(id, { tools: RETURNS_TOOLS });
    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};
      switch (toolName) {
        case "analyze_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const policies = await prisma$1.policy.findMany({
            where: { shop: returnReq.shop, isActive: true },
            orderBy: { priority: "asc" }
          });
          const items = returnReq.items;
          const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0), 0);
          const daysSinceOrder = returnReq.createdAt ? Math.floor((Date.now() - new Date(returnReq.createdAt).getTime()) / (1e3 * 60 * 60 * 24)) : 0;
          let bestPolicy = null;
          for (const policy of policies) {
            const conditions = policy.conditions;
            const matches = conditions.every((c) => {
              if (c.field === "maxDays") return daysSinceOrder <= c.value;
              if (c.field === "maxAmount") return totalAmount <= c.value;
              return true;
            });
            if (matches) {
              bestPolicy = policy;
              break;
            }
          }
          const autoApprove = bestPolicy?.conditions?.find((c) => c.field === "autoApprove")?.value;
          const restockingFee = bestPolicy?.conditions?.find((c) => c.field === "restockingFee")?.value || 0;
          const maxDays = bestPolicy?.conditions?.find((c) => c.field === "maxDays")?.value || 30;
          const maxAmount = bestPolicy?.conditions?.find((c) => c.field === "maxAmount")?.value || 9999;
          let recommendation;
          let confidence;
          if (bestPolicy && autoApprove) {
            recommendation = "approve";
            confidence = 0.9;
          } else if (bestPolicy) {
            recommendation = "review";
            confidence = 0.6;
          } else {
            recommendation = "review";
            confidence = 0.3;
          }
          return jsonRpcResult(id, {
            returnId: returnReq.id,
            orderName: returnReq.orderName,
            customerName: returnReq.customerName,
            totalAmount,
            daysSinceOrder,
            policyMatch: bestPolicy ? {
              name: bestPolicy.name,
              maxDays,
              maxAmount,
              autoApprove: !!autoApprove,
              restockingFee
            } : null,
            recommendation,
            confidence,
            reasoning: bestPolicy ? `Order matches "${bestPolicy.name}": ${daysSinceOrder} days (≤${maxDays}), $${totalAmount} (≤$${maxAmount})${autoApprove ? ", auto-approve enabled" : ""}` : "No matching policy found. Manual review required."
          });
        }
        case "approve_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const items = returnReq.items;
          const totalAmount = args.refundAmount || items.reduce(
            (sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0),
            0
          );
          const session = await prisma$1.session.findFirst({
            where: { shop: returnReq.shop, isOnline: false }
          });
          let refundResult = null;
          if (session?.accessToken) {
            try {
              const orderIdNum = returnReq.orderId.replace("gid://shopify/Order/", "");
              refundResult = await executeRefund(
                returnReq.shop,
                session.accessToken,
                orderIdNum,
                totalAmount,
                true,
                args.notes || "Auto-approved by Shopigent Returns AI agent"
              );
            } catch (err) {
              refundResult = { error: err.message };
            }
          }
          let labelResult = null;
          if (args.issueLabel) {
            labelResult = await createReturnLabel(returnReq.shop, {
              orderName: returnReq.orderName || returnReq.id,
              customerName: returnReq.customerName || "Customer",
              customerEmail: returnReq.customerEmail || "",
              items,
              weight: 1,
              description: returnReq.reason || "Customer return",
              shopAddress: {
                line1: process.env.SHOP_ADDRESS_LINE1 || "",
                city: process.env.SHOP_ADDRESS_CITY || "",
                postalCode: process.env.SHOP_ADDRESS_ZIP || "",
                country: process.env.SHOP_ADDRESS_COUNTRY || "NL"
              }
            });
          }
          const updated = await prisma$1.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: refundResult?.id ? "REFUNDED" : "APPROVED",
              decidedBy: "agent",
              decidedAt: /* @__PURE__ */ new Date(),
              notes: args.notes || null,
              refundAmount: totalAmount,
              refundId: refundResult?.id || null,
              labels: labelResult?.success ? [{ type: "return_label", status: "ready", url: labelResult.labelUrl, tracking: labelResult.trackingNumber }] : args.issueLabel ? [{ type: "return_label", status: "failed", error: labelResult?.error }] : void 0
            }
          });
          await prisma$1.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: refundResult?.id ? "refund" : "approve",
              details: {
                refundAmount: totalAmount,
                refundTransactionId: refundResult?.id || null,
                refundError: refundResult?.error || null,
                issueLabel: args.issueLabel,
                notes: args.notes
              }
            }
          });
          if (returnReq.customerEmail) {
            const emailData = refundResult?.id ? refundProcessedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", totalAmount) : returnApprovedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", totalAmount);
            sendEmail({ ...emailData, to: returnReq.customerEmail });
          }
          return jsonRpcResult(id, {
            success: true,
            status: updated.status,
            returnId: updated.id,
            refundExecuted: !!refundResult?.id,
            refundId: refundResult?.id || null,
            refundError: refundResult?.error || null
          });
        }
        case "deny_return": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const updated = await prisma$1.returnRequest.update({
            where: { id: args.returnId },
            data: {
              status: "DENIED",
              decidedBy: "agent",
              decidedAt: /* @__PURE__ */ new Date(),
              notes: args.reason
            }
          });
          await prisma$1.decisionLog.create({
            data: {
              returnId: args.returnId,
              actor: "agent",
              action: "deny",
              details: { reason: args.reason }
            }
          });
          if (returnReq.customerEmail) {
            sendEmail({ ...returnDeniedEmail(returnReq.customerName || "Customer", returnReq.orderName || "", args.reason), to: returnReq.customerEmail });
          }
          return jsonRpcResult(id, { success: true, status: "DENIED", returnId: updated.id });
        }
        case "check_fraud": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId },
            include: { fraudSignals: true }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const items = returnReq.items;
          const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0), 0);
          const signals = [];
          if (totalAmount > 1e3) {
            signals.push({ signal: "high_value_return", score: 0.3, details: { amount: totalAmount } });
          }
          if (returnReq.customerEmail) {
            const recentCount = await prisma$1.returnRequest.count({
              where: {
                customerEmail: returnReq.customerEmail,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3) }
              }
            });
            if (recentCount > 2) {
              signals.push({ signal: "frequent_returner", score: 0.5, details: { returnsIn30Days: recentCount } });
            }
          }
          for (const s of signals) {
            await prisma$1.fraudSignal.create({
              data: {
                returnId: args.returnId,
                signal: s.signal,
                score: s.score,
                details: s.details
              }
            });
          }
          const maxScore = signals.length > 0 ? Math.max(...signals.map((s) => s.score)) : 0;
          return jsonRpcResult(id, {
            returnId: args.returnId,
            riskLevel: maxScore > 0.5 ? "high" : maxScore > 0.2 ? "medium" : "low",
            riskScore: maxScore,
            signals
          });
        }
        case "list_policies": {
          const policies = await prisma$1.policy.findMany({
            where: { isActive: true },
            orderBy: { priority: "asc" }
          });
          return jsonRpcResult(id, {
            policies: policies.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priority: p.priority,
              conditions: p.conditions
            }))
          });
        }
        case "get_policy_recommendation": {
          const returnReq = await prisma$1.returnRequest.findUnique({
            where: { id: args.returnId }
          });
          if (!returnReq) return jsonRpcError(id, -32602, "Return not found");
          const items = returnReq.items;
          const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price || "0") * (i.quantity || 0), 0);
          const daysSinceOrder = Math.floor((Date.now() - new Date(returnReq.createdAt).getTime()) / (1e3 * 60 * 60 * 24));
          const policies = await prisma$1.policy.findMany({
            where: { shop: returnReq.shop, isActive: true },
            orderBy: { priority: "asc" }
          });
          let bestMatch = null;
          for (const policy of policies) {
            const conditions = policy.conditions;
            const matches = conditions.every((c) => {
              if (c.field === "maxDays") return daysSinceOrder <= c.value;
              if (c.field === "maxAmount") return totalAmount <= c.value;
              return true;
            });
            if (matches) {
              bestMatch = policy;
              break;
            }
          }
          return jsonRpcResult(id, {
            totalAmount,
            daysSinceOrder,
            bestMatch: bestMatch ? {
              name: bestMatch.name,
              conditions: bestMatch.conditions
            } : null
          });
        }
        case "list_returns": {
          const where = {};
          if (args.status) where.status = args.status;
          const returns = await prisma$1.returnRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: args.limit || 10
          });
          return jsonRpcResult(id, {
            returns: returns.map((r) => ({
              id: r.id,
              orderName: r.orderName,
              customerName: r.customerName,
              status: r.status,
              totalItems: r.items.length,
              createdAt: r.createdAt
            }))
          });
        }
        default:
          return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
      }
    }
    default:
      return jsonRpcError(id, -32601, `Unknown method: ${method}`);
  }
}

const action$2 = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const key = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const shop = await prisma$1.shop.findFirst({
    where: { mcpApiKeyHash: hash }
  });
  if (!shop) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid API key" } },
      { status: 401 }
    );
  }
  const body = await request.json();
  if (body.jsonrpc !== "2.0" || !body.method) {
    return json(
      { jsonrpc: "2.0", id: body.id || null, error: { code: -32600, message: "Invalid Request" } },
      { status: 400 }
    );
  }
  const response = await handleMcpRequest(body);
  return json(response);
};
const loader$3 = async () => {
  return json({
    name: "shopigent-returns-mcp",
    version: "0.1.0",
    protocol: "2024-11-05",
    description: "MCP server for Shopigent Returns — AI-agentic return management for Shopify.",
    tools: [
      "analyze_return",
      "approve_return",
      "deny_return",
      "check_fraud",
      "list_policies",
      "get_policy_recommendation",
      "list_returns"
    ]
  });
};

const route8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$2,
  loader: loader$3
}, Symbol.toStringTag, { value: 'Module' }));

const loader$2 = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};
const action$1 = () => {
  return json({ ok: true, service: "shopigent-returns", status: "healthy" });
};

const route9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action: action$1,
  loader: loader$2
}, Symbol.toStringTag, { value: 'Module' }));

const loader$1 = async ({ request }) => {
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
          /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Link$1, { url: `/returns/${id}`, children: orderName || "—" }) }),
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

const route10 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader: loader$1
}, Symbol.toStringTag, { value: 'Module' }));

const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "bundlebuzz-store.myshopify.com";
  return json({ shop });
};
const action = async ({ request }) => {
  const formData = await request.formData();
  const _action = formData.get("_action");
  const shop = formData.get("shop") || "bundlebuzz-store.myshopify.com";
  const email = formData.get("email");
  formData.get("orderName");
  const session = await prisma$1.session.findFirst({
    where: { shop, isOnline: false }
  });
  if (!session?.accessToken) {
    return json({ error: "Store not connected. Please try again later." }, { status: 400 });
  }
  if (_action === "lookup") {
    const query = `{
      customers(first: 1, query: "${email}") {
        edges {
          node {
            id
            firstName
            lastName
            orders(first: 20, sortKey: CREATED_AT, reverse: true) {
              edges {
                node {
                  id
                  name
                  createdAt
                  totalPriceSet {
                    shopMoney { amount currencyCode }
                  }
                  fulfillments(first: 5) { edges { node { status } } }
                  lineItems(first: 20) {
                    edges {
                      node {
                        id
                        title
                        quantity
                        variant { id sku }
                        originalUnitPriceSet { shopMoney { amount } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;
    try {
      const response = await fetch(
        `https://${shop}/admin/api/2024-10/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken
          },
          body: JSON.stringify({ query })
        }
      );
      const data = await response.json();
      const customer = data?.data?.customers?.edges?.[0]?.node;
      if (!customer) {
        return json({ error: "No customer found with this email." });
      }
      const orders = customer.orders.edges.map((e) => {
        const node = e.node;
        const items = node.lineItems.edges.map((li) => ({
          id: li.node.id,
          title: li.node.title,
          quantity: li.node.quantity,
          sku: li.node.variant?.sku || "",
          price: li.node.originalUnitPriceSet?.shopMoney?.amount || "0",
          variantId: li.node.variant?.id || ""
        }));
        return {
          id: node.id,
          name: node.name,
          createdAt: node.createdAt,
          total: node.totalPriceSet?.shopMoney?.amount || "0",
          currency: node.totalPriceSet?.shopMoney?.currencyCode || "USD",
          items,
          fulfilled: node.fulfillments?.edges?.length > 0
        };
      });
      return json({ customer: { name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() }, orders });
    } catch (err) {
      return json({ error: `Failed to look up orders: ${err.message}` });
    }
  }
  if (_action === "submit_return") {
    const orderId = formData.get("orderId");
    const customerName = formData.get("customerName");
    const customerEmail = formData.get("customerEmail");
    const reason = formData.get("reason");
    const selectedItems = JSON.parse(formData.get("selectedItems") || "[]");
    const orderName2 = formData.get("orderName2");
    if (!orderId || selectedItems.length === 0) {
      return json({ error: "Please select at least one item to return." });
    }
    await prisma$1.returnRequest.create({
      data: {
        shop,
        orderId,
        orderName: orderName2,
        customerEmail,
        customerName,
        items: selectedItems,
        reason,
        status: "PENDING"
      }
    });
    return json({ success: true, message: "Return request submitted! We'll review it shortly." });
  }
  return json({ error: "Invalid action" });
};
function ReturnPortal() {
  const { shop } = useLoaderData();
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reason, setReason] = useState("");
  const data = fetcher.data;
  const isLookup = fetcher.state === "submitting" && fetcher.formData?.get("_action") === "lookup";
  const orders = data?.orders || [];
  const customer = data?.customer;
  const error = data?.error;
  const success = data?.success;
  const toggleItem = (itemId) => {
    setSelectedItems(
      (prev) => prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };
  const handleLookup = () => {
    setSelectedOrder(null);
    setSelectedItems([]);
    setReason("");
  };
  if (success) {
    return /* @__PURE__ */ jsx("div", { style: { maxWidth: 600, margin: "40px auto", padding: 20 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", align: "center", children: [
      /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "h1", alignment: "center", tone: "success", children: "✅ Return Submitted!" }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", alignment: "center", children: data.message }),
      /* @__PURE__ */ jsx(Button, { onClick: () => window.location.reload(), children: "Submit Another Return" })
    ] }) }) });
  }
  return /* @__PURE__ */ jsx("div", { style: { maxWidth: 800, margin: "40px auto", padding: 20 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingXl", as: "h1", fontWeight: "bold", children: "Start a Return" }),
    /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", tone: "subdued", children: "Enter your email and find your order to start a return or exchange." }),
    /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", onSubmit: handleLookup, children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "lookup" }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "shop", value: shop }),
      /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsx(
          TextField,
          {
            label: "Email Address",
            type: "email",
            name: "email",
            value: email,
            onChange: setEmail,
            placeholder: "your@email.com",
            autoComplete: "email",
            required: true
          }
        ),
        /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", loading: isLookup, disabled: !email, children: "Look Up My Orders" })
      ] })
    ] }),
    error && /* @__PURE__ */ jsx(Banner, { tone: "critical", children: error }),
    orders.length > 0 && customer && /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
      /* @__PURE__ */ jsxs(Text, { variant: "headingMd", as: "h2", fontWeight: "bold", children: [
        "Welcome, ",
        customer.name,
        "!"
      ] }),
      /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Select an order to return items from:" }),
      orders.map((order) => {
        const orderTotal = parseFloat(order.total);
        const isSelected = selectedOrder === order.id;
        return /* @__PURE__ */ jsxs(
          Card,
          {
            background: isSelected ? "bg-surface-experimental" : void 0,
            children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: { cursor: "pointer" },
                  onClick: () => {
                    setSelectedOrder(isSelected ? null : order.id);
                    setSelectedItems([]);
                  },
                  children: /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                    /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                      /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", fontWeight: "bold", children: order.name }),
                      /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
                        new Date(order.createdAt).toLocaleDateString(),
                        " · ",
                        order.currency,
                        " $",
                        orderTotal.toFixed(2)
                      ] })
                    ] }),
                    order.fulfilled && /* @__PURE__ */ jsx(Text, { variant: "bodySm", as: "span", tone: "success", children: "Delivered" })
                  ] })
                }
              ),
              isSelected && /* @__PURE__ */ jsx("div", { style: { marginTop: 16 }, children: /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", children: [
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "_action", value: "submit_return" }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "shop", value: shop }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "orderId", value: order.id }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "orderName2", value: order.name }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "customerName", value: customer.name }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "customerEmail", value: email }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "selectedItems", value: JSON.stringify(
                  order.items.filter((i) => selectedItems.includes(i.id))
                ) }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "reason", value: reason }),
                /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
                  /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h4", fontWeight: "bold", children: "Select items to return:" }),
                  order.items.map((item) => /* @__PURE__ */ jsxs(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: "1px solid #e0e0e0"
                      },
                      children: [
                        /* @__PURE__ */ jsx(
                          Checkbox,
                          {
                            label: "",
                            checked: selectedItems.includes(item.id),
                            onChange: () => toggleItem(item.id)
                          }
                        ),
                        /* @__PURE__ */ jsxs("div", { style: { flex: 1 }, children: [
                          /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "span", fontWeight: "bold", children: item.title }),
                          /* @__PURE__ */ jsxs(Text, { variant: "bodySm", as: "p", tone: "subdued", children: [
                            "x",
                            item.quantity,
                            " · $",
                            item.price,
                            item.sku && ` · SKU: ${item.sku}`
                          ] })
                        ] })
                      ]
                    },
                    item.id
                  )),
                  /* @__PURE__ */ jsx(
                    TextField,
                    {
                      label: "Reason for return",
                      name: "reason",
                      value: reason,
                      onChange: setReason,
                      placeholder: "e.g. Wrong size, defective, changed mind...",
                      multiline: 2
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      submit: true,
                      variant: "primary",
                      disabled: selectedItems.length === 0,
                      children: "Submit Return Request"
                    }
                  )
                ] })
              ] }) })
            ]
          },
          order.id
        );
      })
    ] }),
    !isLookup && orders.length === 0 && !error && /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "Enter your email above to find your orders and start a return." }) })
  ] }) }) });
}

const route11 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  action,
  default: ReturnPortal,
  loader
}, Symbol.toStringTag, { value: 'Module' }));

const serverManifest = {'entry':{'module':'/assets/entry.client-EuybElju.js','imports':['/assets/components-DncgAStS.js'],'css':[]},'routes':{'root':{'id':'root','parentId':undefined,'path':'','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':true,'module':'/assets/root-DW2RugKk.js','imports':['/assets/components-DncgAStS.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/context-D_7evObr.js'],'css':[]},'routes/returns._index':{'id':'routes/returns._index','parentId':'root','path':'returns','index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/returns._index-BNn-okAg.js','imports':['/assets/components-DncgAStS.js','/assets/Link-D87bG4BI.js','/assets/Page-BRr42oR8.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/context-BKzuUC7w.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/Checkbox-a6VN9RyV.js','/assets/CSSTransition-CYBGIXjC.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/api.webhooks':{'id':'routes/api.webhooks','parentId':'root','path':'api/webhooks','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.webhooks-l0sNRNKZ.js','imports':[],'css':[]},'routes/returns.$id':{'id':'routes/returns.$id','parentId':'root','path':'returns/:id','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/returns._id-Dexd_3jt.js','imports':['/assets/components-DncgAStS.js','/assets/Page-BRr42oR8.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/Tag-BBpjTkTH.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js'],'css':[]},'routes/api.auth.$':{'id':'routes/api.auth.$','parentId':'root','path':'api/auth/*','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.auth._-l0sNRNKZ.js','imports':[],'css':[]},'routes/analytics':{'id':'routes/analytics','parentId':'root','path':'analytics','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/analytics-C061lObq.js','imports':['/assets/components-DncgAStS.js','/assets/Page-BRr42oR8.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js'],'css':[]},'routes/policies':{'id':'routes/policies','parentId':'root','path':'policies','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/policies-DRs8w0RL.js','imports':['/assets/components-DncgAStS.js','/assets/Page-BRr42oR8.js','/assets/Banner-HF13MGyT.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/Tag-BBpjTkTH.js','/assets/context-BKzuUC7w.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-D_7evObr.js','/assets/CSSTransition-CYBGIXjC.js','/assets/Checkbox-a6VN9RyV.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/settings':{'id':'routes/settings','parentId':'root','path':'settings','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/settings-DohPyCIP.js','imports':['/assets/components-DncgAStS.js','/assets/Page-BRr42oR8.js','/assets/Banner-HF13MGyT.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/context-BKzuUC7w.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/api.mcp':{'id':'routes/api.mcp','parentId':'root','path':'api/mcp','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/api.mcp-l0sNRNKZ.js','imports':[],'css':[]},'routes/healthz':{'id':'routes/healthz','parentId':'root','path':'healthz','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/healthz-l0sNRNKZ.js','imports':[],'css':[]},'routes/_index':{'id':'routes/_index','parentId':'root','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/_index-CSS7T_OY.js','imports':['/assets/components-DncgAStS.js','/assets/Link-D87bG4BI.js','/assets/Page-BRr42oR8.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/Banner-HF13MGyT.js','/assets/context-BKzuUC7w.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/Checkbox-a6VN9RyV.js','/assets/CSSTransition-CYBGIXjC.js','/assets/banner-context-DEryxoPe.js'],'css':[]},'routes/return':{'id':'routes/return','parentId':'root','path':'return','index':undefined,'caseSensitive':undefined,'hasAction':true,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasErrorBoundary':false,'module':'/assets/return-Bt11Nt_z.js','imports':['/assets/components-DncgAStS.js','/assets/ButtonGroup-DjCCD5EX.js','/assets/Banner-HF13MGyT.js','/assets/Checkbox-a6VN9RyV.js','/assets/use-is-after-initial-mount-B-sttIaC.js','/assets/banner-context-DEryxoPe.js'],'css':[]}},'url':'/assets/manifest-c7330352.js','version':'c7330352'};

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
  "routes/returns._index": {
          id: "routes/returns._index",
          parentId: "root",
          path: "returns",
          index: true,
          caseSensitive: undefined,
          module: route1
        },
  "routes/api.webhooks": {
          id: "routes/api.webhooks",
          parentId: "root",
          path: "api/webhooks",
          index: undefined,
          caseSensitive: undefined,
          module: route2
        },
  "routes/returns.$id": {
          id: "routes/returns.$id",
          parentId: "root",
          path: "returns/:id",
          index: undefined,
          caseSensitive: undefined,
          module: route3
        },
  "routes/api.auth.$": {
          id: "routes/api.auth.$",
          parentId: "root",
          path: "api/auth/*",
          index: undefined,
          caseSensitive: undefined,
          module: route4
        },
  "routes/analytics": {
          id: "routes/analytics",
          parentId: "root",
          path: "analytics",
          index: undefined,
          caseSensitive: undefined,
          module: route5
        },
  "routes/policies": {
          id: "routes/policies",
          parentId: "root",
          path: "policies",
          index: undefined,
          caseSensitive: undefined,
          module: route6
        },
  "routes/settings": {
          id: "routes/settings",
          parentId: "root",
          path: "settings",
          index: undefined,
          caseSensitive: undefined,
          module: route7
        },
  "routes/api.mcp": {
          id: "routes/api.mcp",
          parentId: "root",
          path: "api/mcp",
          index: undefined,
          caseSensitive: undefined,
          module: route8
        },
  "routes/healthz": {
          id: "routes/healthz",
          parentId: "root",
          path: "healthz",
          index: undefined,
          caseSensitive: undefined,
          module: route9
        },
  "routes/_index": {
          id: "routes/_index",
          parentId: "root",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route10
        },
  "routes/return": {
          id: "routes/return",
          parentId: "root",
          path: "return",
          index: undefined,
          caseSensitive: undefined,
          module: route11
        }
      };

export { serverManifest as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, mode, publicPath, routes };
