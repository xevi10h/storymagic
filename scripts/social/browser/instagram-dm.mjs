// Sends one Instagram direct message from @meapica_books to an account that has not written first (the API cannot).
// Needs the logged-in browser profile `instagram` (skill browser-session; the owner logs in once).
//   node ~/.claude/skills/browser-session/pw-session.mjs run instagram scripts/social/browser/instagram-dm.mjs <handle> <shot.png> [send]
// Reads the text from dms.json next to this file: { "<handle>": "<message>" } (not tracked: write it per campaign).
// Without "send" it only types the text, for a screenshot check. New account: a few messages, minutes apart.
import { readFileSync } from "node:fs";
export default async ({ page, args }) => {
  const [handle, shot, mode] = args;
  const text = JSON.parse(readFileSync(new URL("./dms.json", import.meta.url), "utf8"))[handle];
  if (!text) throw new Error(`no message for ${handle}`);
  const dismiss = async () => { for (const t of ["Ahora no", "Not now", "Not Now"]) { const b = page.getByRole("button", { name: t }).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); } };
  await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000); await dismiss();
  const me = await page.evaluate(() => document.cookie.match(/ds_user_id=(\d+)/)?.[1] ?? null);
  const btn = page.getByRole("button", { name: /^(Enviar mensaje|Message|Mensaje)$/ }).first();
  if (!(await btn.isVisible().catch(() => false))) { await page.screenshot({ path: shot }); return { handle, step: "no message button", url: page.url(), me }; }
  await btn.click(); await page.waitForTimeout(6000); await dismiss();
  const box = page.locator('div[role="textbox"][contenteditable="true"]').last();
  await box.waitFor({ timeout: 20000 });
  const before = await page.locator('div[role="row"]').count();
  await box.click(); await page.keyboard.press("Meta+A"); await page.keyboard.press("Backspace"); // a draft from an earlier run must not be sent twice
  await page.keyboard.type(text, { delay: 28 });
  const typed = (await box.innerText()).replace(/\s+/g, " ").trim();
  if (typed !== text.replace(/\s+/g, " ").trim()) { await page.screenshot({ path: shot }); return { handle, step: "typed text differs, not sent", typed: typed.slice(0, 120) }; }
  await page.waitForTimeout(1500);
  if (mode === "send") { await page.keyboard.press("Enter"); await page.waitForTimeout(6000); }
  await page.screenshot({ path: shot });
  return { handle, step: mode === "send" ? "sent" : "typed, not sent", url: page.url(), me, rowsBefore: before, rowsAfter: await page.locator('div[role="row"]').count() };
};
