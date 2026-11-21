// Facts the guide copy interpolates: product facts + this season's Christmas and Reyes cut-offs.

import { cutoffDateParams, factParams } from "@/lib/product-facts";
import { formatPrice } from "@/lib/pricing";
import type { GuideFacts } from "./types";

export function guideFacts(locale: string): GuideFacts {
  return {
    ...factParams((cents) => formatPrice(cents, locale)),
    ...cutoffDateParams(locale),
  };
}
