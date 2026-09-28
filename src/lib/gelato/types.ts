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

// Webhook events (Gelato dashboard → Developer → Webhooks). Shapes verified
// against dashboard.gelato.com/docs/webhooks on 2026-09-28. Gelato sends no
// signature: the endpoint is authenticated by ?secret= in the registered URL.

export interface GelatoWebhookFulfillment {
  trackingCode?: string | null;
  trackingUrl?: string | null;
  shipmentMethodName?: string;
  shipmentMethodUid?: string;
}

interface GelatoWebhookBase {
  id: string;
  orderId: string;
  orderReferenceId: string;
  storeId?: string | null;
}

export interface GelatoOrderStatusUpdatedEvent extends GelatoWebhookBase {
  event: "order_status_updated";
  fulfillmentStatus: string;
  items?: { itemReferenceId: string; fulfillmentStatus?: string; fulfillments?: GelatoWebhookFulfillment[] }[];
}

/** Item-level status (flat, field is `status`). Redundant for our one-item orders. */
export interface GelatoOrderItemStatusUpdatedEvent extends GelatoWebhookBase {
  event: "order_item_status_updated";
  itemReferenceId: string;
  status: string;
}

export interface GelatoOrderItemTrackingCodeUpdatedEvent extends GelatoWebhookBase, GelatoWebhookFulfillment {
  event: "order_item_tracking_code_updated";
  itemReferenceId: string;
}

export type GelatoWebhookEvent =
  | GelatoOrderStatusUpdatedEvent
  | GelatoOrderItemStatusUpdatedEvent
  | GelatoOrderItemTrackingCodeUpdatedEvent;

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
