// Gelato API — base HTTP client (no SDK, plain fetch)

const ORDER_BASE = "https://order.gelatoapis.com";
const PRODUCT_BASE = "https://product.gelatoapis.com";

function getApiKey(): string {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error("GELATO_API_KEY is not configured");
  return key;
}

/** Non-2xx response from Gelato. `status` lets callers tell 4xx (fix input) from 5xx (retry). */
export class GelatoApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, body: string) {
    super(`Gelato API error ${status} at ${path}: ${body.slice(0, 500)}`);
    this.name = "GelatoApiError";
    this.status = status;
    this.path = path;
  }
}

// Per-request timeout so a hung Gelato call can't eat a whole function invocation.
const REQUEST_TIMEOUT_MS = 30_000;

async function gelatoFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": getApiKey(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GelatoApiError(response.status, path, body);
  }

  return response.json() as Promise<T>;
}

/** Call the Gelato Orders API (order.gelatoapis.com) */
export function gelatoOrderFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  return gelatoFetch<T>(ORDER_BASE, path, options);
}

/** Call the Gelato Product/Catalog API (product.gelatoapis.com) */
export function gelatoProductFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  return gelatoFetch<T>(PRODUCT_BASE, path, options);
}
