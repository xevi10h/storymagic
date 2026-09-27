// Gelato Print API — TypeScript types
// API docs: https://dashboard.gelato.com/docs/

export interface GelatoAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  country: string; // ISO 3166-1 alpha-2 (e.g. "ES")
  email: string;
  phone?: string;
}

export interface GelatoFileItem {
  // "default" = cover spread PDF, "inside" = interior pages PDF
  type: "default" | "inside";
  url: string; // publicly accessible URL; Gelato fetches this
}

export interface GelatoOrderItem {
  itemReferenceId: string;
  productUid: string;
  pageCount: number; // required for photo books — inner pages only (e.g. 30)
  files: GelatoFileItem[];
  quantity: number;
}

export interface GelatoOrderRequest {
  orderType: "order" | "draft";
  orderReferenceId: string;
  customerReferenceId?: string;
  currency: string;
  items: GelatoOrderItem[];
  shipmentMethodUid: string;
  shippingAddress: GelatoAddress;
}

export interface GelatoOrderItem_Response {
  id: string;
  itemReferenceId: string;
  fulfillmentStatus: string;
}

export interface GelatoOrderResponse {
  id: string;
  orderReferenceId: string;
  customerReferenceId?: string;
  fulfillmentStatus: string;
  financialStatus: string;
  currency: string;
  items: GelatoOrderItem_Response[];
  shipment?: {
    id: string;
    trackingCode?: string;
    trackingUrl?: string;
    carrierName?: string;
  };
  created: string;
  updated: string;
}

export interface GelatoQuoteItem {
  itemReferenceId: string;
  productUid: string;
  pageCount: number;
  files: GelatoFileItem[];
  quantity: number;
}

export interface GelatoQuoteRequest {
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  products: GelatoQuoteItem[]; // v4 quote uses "products", not "items"
  recipient: GelatoAddress;    // v4 quote uses "recipient", not "shippingAddress"
}

export interface GelatoQuoteShipmentMethod {
  shipmentMethodUid: string;
  displayName: string;
  currency: string;
  price: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
}

export interface GelatoQuoteProduct {
  itemReferenceId: string;
  productUid: string;
  currency: string;
  price: number;
}

export interface GelatoQuoteResponse {
  orderReferenceId: string;
  products: GelatoQuoteProduct[];
  shipmentMethods: GelatoQuoteShipmentMethod[];
}

// Webhook event types (configured in Gelato dashboard → Developer → Webhooks)
export type GelatoWebhookEventType =
  | "order_status_updated"
  | "order_item_status_updated";

export interface GelatoWebhookItemShipment {
  trackingCode?: string;
  trackingUrl?: string;
  carrierName?: string;
}

export interface GelatoWebhookItem {
  id: string;
  itemReferenceId: string;
  fulfillmentStatus?: string;
  shipment?: GelatoWebhookItemShipment;
}

export interface GelatoWebhookEvent {
  id: string;
  event: GelatoWebhookEventType;
  orderId: string;
  orderReferenceId: string;
  fulfillmentStatus?: string;
  items?: GelatoWebhookItem[];
}

// ── Catalog: cover dimensions (GET /v3/products/{uid}/cover-dimensions?pageCount=N) ──
// Verified against the live API 2026-09-27. Units: mm, origin top-left of the cover file.
// Softcover returns bleedSize; hardcover returns wraparoundInsideSize/wraparoundEdgeSize + joints.

export interface GelatoMmBox {
  width: number;
  height: number;
  left: number;
  top: number;
  /** Present on outer boxes: bleed (softcover 3) / wraparound (hardcover 17) / board edge (3) */
  thickness?: number;
}

export interface GelatoCoverDimensionsResponse {
  productUid: string;
  /** Inner pages + 4 cover sides (30 inner → 34) */
  pagesCount?: number;
  measureUnit?: string;
  /** Softcover: whole cover file incl. bleed */
  bleedSize?: GelatoMmBox;
  /** Hardcover: whole cover file incl. wraparound */
  wraparoundInsideSize?: GelatoMmBox;
  /** Hardcover: board edge band just inside the wraparound */
  wraparoundEdgeSize?: GelatoMmBox;
  contentBackSize?: GelatoMmBox;
  jointBackSize?: GelatoMmBox;
  spineSize?: GelatoMmBox;
  jointFrontSize?: GelatoMmBox;
  contentFrontSize?: GelatoMmBox;
}
