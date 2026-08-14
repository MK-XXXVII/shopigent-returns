import prisma from "./db.server";

// Unified label generation interface
// Multiple providers: SendCloud (EU/NL), Shippo (US), EasyPost (Global)

export interface LabelRequest {
  orderName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string;
  };
  shopAddress: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string;
  };
  items: { title: string; quantity: number; sku?: string }[];
  weight?: number; // kg
  description?: string;
}

export interface LabelResult {
  success: boolean;
  labelUrl?: string;
  trackingNumber?: string;
  labelId?: string;
  cost?: number;
  error?: string;
}

export type LabelProvider = "sendcloud" | "shippo" | "easypost";

// Get label config — DB first, fallback to env vars
export async function getLabelConfig(shop: string) {
  const shopRec = await prisma.shop.findUnique({ where: { shop } });
  const dbConfig: any = shopRec?.config || {};

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
      country: process.env.SHOP_ADDRESS_COUNTRY || "NL",
    },
  };
}

// Main label creation dispatcher — now takes shop domain
export async function createReturnLabel(shop: string, request: LabelRequest): Promise<LabelResult> {
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

// === SendCloud (EU/NL — PostNL, DHL, DPD) ===
// Docs: POST /api/v2/parcels with request_label=true
async function createSendCloudLabel(req: LabelRequest, apiKey: string, apiSecret: string): Promise<LabelResult> {
  if (!apiKey || !apiSecret) {
    return { success: false, error: "SendCloud not configured (SENDCLOUD_API_KEY + SENDCLOUD_API_SECRET)" };
  }

  try {
    // Find the first available shipping method
    // First try to get shipping methods from SendCloud
    let shipmentId = 7; // default PostNL
    try {
      const methodsResp = await fetch("https://panel.sendcloud.sc/api/v2/shipping_methods", {
        headers: { "Authorization": "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64") },
      });
      if (methodsResp.ok) {
        const methodsData = await methodsResp.json();
        if (methodsData.shipping_methods?.length > 0) {
          shipmentId = methodsData.shipping_methods[0].id;
        }
      }
    } catch {}

    const response = await fetch("https://panel.sendcloud.sc/api/v2/parcels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64"),
      },
      body: JSON.stringify({
        parcel: {
          name: req.customerName,
          company_name: "",
          address: req.customerAddress?.line1?.replace(/\d+$/, "").trim() || req.shopAddress.line1?.replace(/\d+$/, "").trim() || "",
          house_number: (req.customerAddress?.line1 || req.shopAddress.line1 || "").match(/(\d+.*)$/)?.[1] || "1",
          address_2: req.customerAddress?.line2 || req.shopAddress.line2 || "",
          city: req.customerAddress?.city || req.shopAddress.city || "",
          postal_code: req.customerAddress?.postalCode || req.shopAddress.postalCode || "",
          telephone: req.customerPhone || "",
          email: req.customerEmail,
          country: req.customerAddress?.country || req.shopAddress.country || "NL",
          weight: String(req.weight || 1),
          order_number: req.orderName,
          request_label: true,
          shipment: { id: shipmentId },
          quantity: req.items.reduce((s: number, i: any) => s + i.quantity, 1),
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `SendCloud error: ${response.status} ${err.slice(0, 300)}` };
    }

    const data = await response.json();
    const parcel = data.parcel || data;

    return {
      success: true,
      labelUrl: parcel.label?.label_printer || parcel.label?.normal_printer?.[0] || parcel.documents?.[0]?.link || "",
      trackingNumber: parcel.tracking_number || "",
      labelId: String(parcel.id || ""),
      cost: parcel.total_order_value ? parseFloat(parcel.total_order_value) : undefined,
    };
  } catch (err: any) {
    return { success: false, error: `SendCloud error: ${err.message}` };
  }
}

// === Shippo (US/Global — 85+ carriers) ===
// Docs: https://docs.goshippo.com/docs/transactions/transactions/
async function createShippoLabel(req: LabelRequest, apiKey: string): Promise<LabelResult> {
  if (!apiKey) {
    return { success: false, error: "Shippo not configured (SHIPPO_API_KEY)" };
  }

  try {
    // Create shipment first
    const shipmentResp = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ShippoToken ${apiKey}`,
      },
      body: JSON.stringify({
        address_from: {
          name: "Returns",
          street1: req.shopAddress.line1,
          street2: req.shopAddress.line2 || "",
          city: req.shopAddress.city,
          state: req.shopAddress.state || "",
          zip: req.shopAddress.postalCode,
          country: req.shopAddress.country,
        },
        address_to: {
          name: req.customerName,
          street1: req.customerAddress?.line1 || req.shopAddress.line1,
          street2: req.customerAddress?.line2 || "",
          city: req.customerAddress?.city || req.shopAddress.city,
          state: req.customerAddress?.state || "",
          zip: req.customerAddress?.postalCode || req.shopAddress.postalCode,
          country: req.customerAddress?.country || req.shopAddress.country,
        },
        parcels: [{
          length: "30",
          width: "20",
          height: "10",
          distance_unit: "cm",
          weight: String(req.weight || 1),
          mass_unit: "kg",
        }],
        async: false,
      }),
    });

    if (!shipmentResp.ok) {
      return { success: false, error: `Shippo shipment failed: ${await shipmentResp.text()}` };
    }

    const shipment = await shipmentResp.json();

    // Purchase the label (select first rate)
    if (!shipment.rates?.length) {
      return { success: false, error: "No shipping rates available" };
    }

    const rateId = shipment.rates[0].object_id;
    const labelResp = await fetch("https://api.goshippo.com/transactions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ShippoToken ${apiKey}`,
      },
      body: JSON.stringify({
        rate: rateId,
        label_file_type: "PDF",
        async: false,
      }),
    });

    if (!labelResp.ok) {
      return { success: false, error: `Shippo label failed: ${await labelResp.text()}` };
    }

    const label = await labelResp.json();
    console.log(`[shippo-label] full response keys: ${Object.keys(label).join(",")}`);

    // Extract label URL robustly — label_url is top-level key
    let labelUrl = (label.label_url || "").trim();

    // If still empty after creation, the transaction might be async; wait and fetch
    if (!labelUrl && label.object_id) {
      console.log(`[shippo-label] label_url empty, fetching transaction ${label.object_id}...`);
      try {
        const fetchRes = await fetch(`https://api.goshippo.com/transactions/${label.object_id}/`, {
          headers: { "Authorization": `ShippoToken ${apiKey}` },
        });
        if (fetchRes.ok) {
          const fullTx = await fetchRes.json();
          labelUrl = fullTx.label_url || "";
        }
      } catch {}
    }

    return {
      success: true,
      labelUrl,
      trackingNumber: label.tracking_number || label.trackingNumber || "",
      labelId: label.object_id || label.id || "",
      cost: label.amount ? parseFloat(label.amount) : undefined,
    };
  } catch (err: any) {
    return { success: false, error: `Shippo error: ${err.message}` };
  }
}

// === EasyPost (Global — UPS, FedEx, USPS, DHL) ===
// Docs: https://www.easypost.com/docs/api
async function createEasyPostLabel(req: LabelRequest, apiKey: string): Promise<LabelResult> {
  if (!apiKey) {
    return { success: false, error: "EasyPost not configured (EASYPOST_API_KEY)" };
  }

  try {
    // Create shipment
    const shipmentResp = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        shipment: {
          from_address: {
            street1: req.shopAddress.line1,
            street2: req.shopAddress.line2 || "",
            city: req.shopAddress.city,
            state: req.shopAddress.state || "",
            zip: req.shopAddress.postalCode,
            country: req.shopAddress.country,
          },
          to_address: {
            name: req.customerName,
            street1: req.customerAddress?.line1 || req.shopAddress.line1,
            street2: req.customerAddress?.line2 || "",
            city: req.customerAddress?.city || req.shopAddress.city,
            state: req.customerAddress?.state || "",
            zip: req.customerAddress?.postalCode || req.shopAddress.postalCode,
            country: req.customerAddress?.country || req.shopAddress.country,
          },
          parcel: {
            length: 30,
            width: 20,
            height: 10,
            weight: req.weight || 1,
          },
        },
      }),
    });

    if (!shipmentResp.ok) {
      return { success: false, error: `EasyPost shipment failed: ${await shipmentResp.text()}` };
    }

    const shipment = await shipmentResp.json();

    // Buy the cheapest rate
    if (!shipment.rates?.length) {
      return { success: false, error: "No shipping rates available" };
    }

    const rate = shipment.rates.sort((a: any, b: any) => parseFloat(a.rate) - parseFloat(b.rate))[0];

    const buyResp = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ rate: { id: rate.id } }),
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
      cost: parseFloat(rate.rate),
    };
  } catch (err: any) {
    return { success: false, error: `EasyPost error: ${err.message}` };
  }
}