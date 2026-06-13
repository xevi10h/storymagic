import { test, expect } from "@playwright/test";
test("no step-1 flash when restoring a step-2 draft", async ({ page }) => {
  test.setTimeout(60000);
  // seed a step-2 draft directly on /crear (not via home, so DevReset doesn't wipe it)
  await page.goto("/ca/crear", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("meapica_create_state", JSON.stringify({
      currentStep: 2, mode: "solo",
      character: { name: "Pa", age: 5, gender: "neutral", interests: [], hairColor:"#3b2a20", eyeColor:"#5b3a29", skinTone:"#f1c9a5", hairstyle:"corto", favoriteColor:"#E86C3A", city:"" },
      portraitUrl: "https://picsum.photos/seed/pa/300/300", recraftStyleId:null, portraitCharacterSnapshot:null,
      selectedTemplate: null, decisions: {}, dedication:"", senderName:"", ending:null, endingNote:"",
    }));
  });
  // sample the DOM rapidly during reload to catch any step-1 flash
  await page.goto("/ca/crear", { waitUntil: "commit" });
  let sawCharForm = 0, sawWorld = 0;
  for (let i = 0; i < 40; i++) {
    const r = await page.evaluate(() => ({
      charInput: !!document.querySelector('input[placeholder*="Leo"], input[placeholder*="Ex:"], input[placeholder*="Ej:"]'),
      worldQ: !!document.querySelector('.path-chapter h2') || /comen|empieza|begins|commence/i.test(document.body.innerText || ""),
    })).catch(() => ({ charInput:false, worldQ:false }));
    if (r.charInput) sawCharForm++;
    if (r.worldQ) sawWorld++;
    await page.waitForTimeout(50);
  }
  console.log(`sawCharForm=${sawCharForm} sawWorld=${sawWorld}`);
  expect(sawCharForm).toBe(0);   // never flashed the character step
  expect(sawWorld).toBeGreaterThan(0); // landed on the path (world) step
});
