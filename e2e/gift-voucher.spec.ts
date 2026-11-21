import { test, expect } from "@playwright/test";

// Gift voucher page during / after Black Friday (src/lib/black-friday.ts, 2026-11-21: −20 % on cards too).
// Server-rendered from the TEST Stripe account (getPromotionSetup); the checkout call is mocked.
//   npx playwright test e2e/gift-voucher.spec.ts

test("Black Friday: struck list price, sale price, Omnibus line, sale price on the button", async ({ page }) => {
  let body: unknown = null;
  await page.route("**/api/gift-voucher/checkout", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { url: "http://localhost:3013/__stripe_mock" } });
  });
  await page.route("**/__stripe_mock", (route) => route.fulfill({ contentType: "text/html", body: "<h1>stripe</h1>" }));
  await page.goto("/es/gift-voucher?now=2026-11-30");
  test.skip((await page.getByTestId("gift-voucher-unavailable").count()) > 0, "vouchers not set up on this Stripe account");
  await expect(page.getByTestId("voucher-price-hardcover")).toHaveText(/49,90\s*€\s*39,92\s*€/);
  await expect(page.getByTestId("voucher-price-softcover")).toHaveText(/34,90\s*€\s*27,92\s*€/);
  await expect(page.getByTestId("voucher-price-digital_pdf")).toHaveText(/9,90\s*€\s*7,92\s*€/);
  await expect(page.getByTestId("voucher-black-friday")).toContainText(/hasta el 30 de noviembre.*últimos 30 días: 49,90\s*€/);
  await expect(page.getByTestId("voucher-buy")).toContainText(/39,92\s*€/);
  await page.getByTestId("voucher-format-softcover").click();
  await expect(page.getByTestId("voucher-black-friday")).toContainText(/34,90\s*€/);
  await expect(page.getByTestId("voucher-buy")).toContainText(/27,92\s*€/);
  await page.getByTestId("voucher-buy").click();
  await page.waitForURL("**/__stripe_mock");
  expect(body).toMatchObject({ format: "softcover", locale: "es" });
});

test("1 December: list prices, no Black Friday line", async ({ page }) => {
  await page.goto("/es/gift-voucher?now=2026-12-01");
  test.skip((await page.getByTestId("gift-voucher-unavailable").count()) > 0, "vouchers not set up on this Stripe account");
  await expect(page.getByTestId("voucher-price-hardcover")).toHaveText(/^49,90\s*€$/);
  await expect(page.getByTestId("voucher-black-friday")).toHaveCount(0);
  await expect(page.getByTestId("voucher-buy")).toContainText(/49,90\s*€/);
});
