import Stripe from "stripe";

type StripeEnvironment = "test" | "live";

function getActiveEnvironment(): StripeEnvironment {
  const env = process.env.STRIPE_ENVIRONMENT ?? "test";
  if (env !== "test" && env !== "live") {
    throw new Error(`Invalid STRIPE_ENVIRONMENT "${env}". Must be "test" or "live".`);
  }
  return env;
}

export function getStripeSecretKey(): string {
  const env = getActiveEnvironment();
  const key =
    env === "test"
      ? process.env.STRIPE_SECRET_KEY_TEST
      : process.env.STRIPE_SECRET_KEY_LIVE;

  if (!key || key.startsWith("sk_test_...") || key.startsWith("sk_live_...")) {
    throw new Error(`STRIPE_SECRET_KEY_${env.toUpperCase()} is not configured`);
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const env = getActiveEnvironment();
  const secret =
    env === "test"
      ? process.env.STRIPE_WEBHOOK_SECRET_TEST
      : process.env.STRIPE_WEBHOOK_SECRET_LIVE;

  if (!secret || secret === "whsec_...") {
    throw new Error(`STRIPE_WEBHOOK_SECRET_${env.toUpperCase()} is not configured`);
  }
  return secret;
}

let _stripe: Stripe | null = null;
let _stripeEnv: StripeEnvironment | null = null;

export function getStripe(): Stripe {
  const currentEnv = getActiveEnvironment();
  // Recreate instance if environment switched (e.g. during dev hot-reload)
  if (!_stripe || _stripeEnv !== currentEnv) {
    _stripe = new Stripe(getStripeSecretKey());
    _stripeEnv = currentEnv;
  }
  return _stripe;
}

// Re-export pricing for convenience in server routes
export { PRICING, ADDONS, type BookFormat, type AddonId } from "./pricing";
