// Gelato API — base HTTP client (no SDK, plain fetch)

const ORDER_BASE = "https://order.gelatoapis.com";
const PRODUCT_BASE = "https://product.gelatoapis.com";

function getApiKey(): string {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error("GELATO_API_KEY is not configured");
  return key;
}

async function gelatoFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": getApiKey(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gelato API error ${response.status} at ${path}: ${body}`);
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
