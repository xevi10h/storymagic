import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Re-export pricing for convenience in server routes
export { PRICING, ADDONS, type BookFormat, type AddonId } from "./pricing";
