// Gelato Print API — order management
//
// Phase 1 (MVP): GELATO_FULFILLMENT_MODE=owner → ships to Xavier's address.
//   Xavier adds custom packaging, ships to customer manually.
//
// Phase 2 (scale): GELATO_FULFILLMENT_MODE=direct → ships directly to customer.
//
// Required env vars:
//   GELATO_API_KEY
//   GELATO_PRODUCT_UID_SOFTCOVER   — from Gelato dashboard → Catalogue
//   GELATO_PRODUCT_UID_HARDCOVER   — from Gelato dashboard → Catalogue
//   GELATO_FULFILLMENT_MODE        — "owner" | "direct" (default: "owner")
//
// Phase 1 owner address env vars:
//   GELATO_OWNER_FIRST_NAME, GELATO_OWNER_LAST_NAME, GELATO_OWNER_ADDRESS_LINE1
//   GELATO_OWNER_ADDRESS_LINE2 (optional), GELATO_OWNER_CITY, GELATO_OWNER_STATE (optional)
//   GELATO_OWNER_POSTAL_CODE, GELATO_OWNER_COUNTRY (default: "ES")
//   GELATO_OWNER_EMAIL, GELATO_OWNER_PHONE (optional)

import { gelatoOrderFetch } from "./client";
import type { GelatoAddress } from "./types";

// ── Inner type helpers ──────────────────────────────────────────────────────

interface GelatoOrderItem {
  itemReferenceId: string;
  productUid: string;
  pageCount: number; // required for photo books
  files: { type: "default" | "inside"; url: string }[];
  quantity: number;
}

interface GelatoOrderRequest {
  orderType: "order" | "draft";
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  items: GelatoOrderItem[];
  shipmentMethodUid?: string; // "normal" | "express" — omit to let Gelato pick cheapest
  shippingAddress: GelatoAddress;
}

// Quote API uses different field names than create order
interface GelatoQuoteItem {
  itemReferenceId: string;
  productUid: string;
  pageCount: number;
  files: { type: "default" | "inside"; url: string }[];
  quantity: number;
}

interface GelatoQuoteRequest {
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  products: GelatoQuoteItem[]; // "products" in quote, "items" in create
  recipient: GelatoAddress;    // "recipient" in quote, "shippingAddress" in create
}

export interface GelatoOrderResponse {
  id: string;
  orderReferenceId: string;
  fulfillmentStatus: string;
  financialStatus: string;
  currency: string;
  items: { id: string; itemReferenceId: string; fulfillmentStatus: string }[];
}

export interface GelatoQuoteShipmentMethod {
  shipmentMethodUid: string;
  name: string;
  type: "normal" | "express" | "pallet";
  price: number;
  currency: string;
  minDeliveryDays: number;
  maxDeliveryDays: number;
}

export interface GelatoQuoteResponse {
  orderReferenceId: string;
  quotes: {
    id: string;
    fulfillmentCountry: string;
    products: { itemReferenceId: string; price: number; currency: string }[];
    shipmentMethods: GelatoQuoteShipmentMethod[];
  }[];
}

// ── Config helpers ──────────────────────────────────────────────────────────

function getProductUid(format: "softcover" | "hardcover"): string {
  const key =
    format === "hardcover"
      ? "GELATO_PRODUCT_UID_HARDCOVER"
      : "GELATO_PRODUCT_UID_SOFTCOVER";
  const uid = process.env[key];
  if (!uid) throw new Error(`${key} is not configured`);
  return uid;
}

function getOwnerAddress(): GelatoAddress {
  const required = (key: string) => {
    const v = process.env[key];
    if (!v) throw new Error(`${key} is required when GELATO_FULFILLMENT_MODE=owner`);
    return v;
  };
  return {
    firstName: required("GELATO_OWNER_FIRST_NAME"),
    lastName: required("GELATO_OWNER_LAST_NAME"),
    addressLine1: required("GELATO_OWNER_ADDRESS_LINE1"),
    addressLine2: process.env.GELATO_OWNER_ADDRESS_LINE2,
    city: required("GELATO_OWNER_CITY"),
    state: process.env.GELATO_OWNER_STATE,
    postCode: required("GELATO_OWNER_POSTAL_CODE"),
    country: process.env.GELATO_OWNER_COUNTRY ?? "ES",
    email: required("GELATO_OWNER_EMAIL"),
    phone: process.env.GELATO_OWNER_PHONE,
  };
}

function resolveShippingAddress(params: PrintOrderParams): GelatoAddress {
  const mode = process.env.GELATO_FULFILLMENT_MODE ?? "owner";
  if (mode === "direct" && params.shippingAddress) {
    return params.shippingAddress;
  }
  return getOwnerAddress();
}

// ── Number of inner pages ───────────────────────────────────────────────────
// Our book: 32 total pages — 1 front cover + 30 inner pages + 1 back cover.
// The front and back cover form the cover spread (type: "default").
// Gelato counts only inner pages in pageCount.
const INNER_PAGE_COUNT = 30;

// ── Public API ──────────────────────────────────────────────────────────────

export interface PrintOrderParams {
  /** Unique reference for idempotency */
  orderReferenceId: string;
  storyId: string;
  format: "softcover" | "hardcover";
  /** Signed URL for the INTERIOR PDF (pages 2–31, type "inside") */
  interiorPdfUrl: string;
  /** Signed URL for the COVER SPREAD PDF (wide spread, type "default") */
  coverSpreadPdfUrl: string;
  /** Customer address — only used when GELATO_FULFILLMENT_MODE=direct */
  shippingAddress?: GelatoAddress;
  /** Number of copies to print (default: 1). Set to 2 when extra_copy addon is purchased. */
  quantity?: number;
}

/**
 * Get a price quote without placing a live order.
 * Returns available shipment methods with prices and delivery estimates.
 */
export async function quotePrintOrder(
  params: PrintOrderParams,
): Promise<GelatoQuoteResponse> {
  const address = resolveShippingAddress(params);
  const body: GelatoQuoteRequest = {
    orderReferenceId: params.orderReferenceId,
    customerReferenceId: params.storyId,
    currency: "EUR",
    products: [
      {
        itemReferenceId: `${params.storyId}-book`,
        productUid: getProductUid(params.format),
        pageCount: INNER_PAGE_COUNT,
        files: [
          { type: "default", url: params.coverSpreadPdfUrl },
          { type: "inside", url: params.interiorPdfUrl },
        ],
        quantity: 1,
      },
    ],
    recipient: address,
  };
  return gelatoOrderFetch<GelatoQuoteResponse>("/v4/orders:quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Submit a print order to Gelato.
 * Phase 1: ships to owner (GELATO_FULFILLMENT_MODE=owner).
 * Phase 2: ships to customer (GELATO_FULFILLMENT_MODE=direct).
 */
export async function createPrintOrder(
  params: PrintOrderParams,
): Promise<GelatoOrderResponse> {
  const address = resolveShippingAddress(params);
  // Use "draft" when Stripe is in test mode — prevents real print charges
  const orderType = process.env.STRIPE_ENVIRONMENT === "live" ? "order" : "draft";
  const body: GelatoOrderRequest = {
    orderType,
    orderReferenceId: params.orderReferenceId,
    customerReferenceId: params.storyId,
    currency: "EUR",
    items: [
      {
        itemReferenceId: `${params.storyId}-book`,
        productUid: getProductUid(params.format),
        pageCount: INNER_PAGE_COUNT,
        files: [
          { type: "default", url: params.coverSpreadPdfUrl },
          { type: "inside", url: params.interiorPdfUrl },
        ],
        quantity: params.quantity ?? 1,
      },
    ],
    shipmentMethodUid: "normal",
    shippingAddress: address,
  };
  return gelatoOrderFetch<GelatoOrderResponse>("/v4/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
