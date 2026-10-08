// Reads balance, monthly spend and key list of the Higgsfield API console (no balance endpoint exists). Read-only.
//   node ~/.claude/skills/browser-session/pw-session.mjs run higgsfield-api scripts/social/browser/higgsfield-balance.mjs <screenshot prefix>
export default async ({ page, args }) => {
  const out = {};
  for (const [name, url] of [["billing", "https://open.higgsfield.ai/billing"], ["keys", "https://open.higgsfield.ai/api-keys"], ["usage", "https://open.higgsfield.ai/usage"]]) {
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${args[0]}-${name}.png`, fullPage: true }).catch(() => {});
    // API key secrets are never read: only dates and names on the keys page.
    out[name] = { url: page.url(), text: (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").replace(/[A-Za-z0-9_-]{28,}/g, "[redacted]").slice(0, 900) };
  }
  return out;
};
