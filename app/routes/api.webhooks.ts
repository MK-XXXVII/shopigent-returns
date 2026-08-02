import shopify from "../shopify.server";
import prisma from "../lib/db.server";

export async function action({ request }: { request: Request }) {
  const { topic, shop, session, admin } = await shopify.authenticate.webhook(
    request
  );

  switch (topic) {
    case "APP_UNINSTALLED": {
      await prisma.shop.updateMany({
        where: { shop },
        data: { uninstalledAt: new Date() },
      });
      break;
    }
    case "ORDERS_FULFILLED": {
      const payload = await request.json();
      const orderId = payload.id;
      const orderName = payload.name;
      const customerEmail = payload.email || payload.contact_email;
      const customerName = payload.customer
        ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim()
        : null;

      // Start a return window for this order
      await prisma.returnRequest.create({
        data: {
          shop,
          orderId: `gid://shopify/Order/${orderId}`,
          orderName,
          customerEmail,
          customerName,
          items: (payload.line_items || []).map((item: any) => ({
            variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
          })),
          status: "PENDING",
        },
      });
      break;
    }
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response(null, { status: 200 });
}