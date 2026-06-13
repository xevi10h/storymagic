import { test, expect } from "@playwright/test";
async function click(page, re: RegExp){const b=page.locator("button",{hasText:re}).first();await b.waitFor({state:"visible",timeout:15000});await b.click();}
const VPS = { desktop:{width:1440,height:900}, mobile:{width:390,height:844} };
for (const [vp,size] of Object.entries(VPS)) {
  test(`pathbuilder ${vp}`, async ({ page }) => {
    test.setTimeout(120000);
    const errs:string[]=[]; page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
    await page.setViewportSize(size);
    await page.goto("/es/crear",{waitUntil:"networkidle"});
    await page.getByPlaceholder("Ej: Leo").fill("Martina");
    await click(page,/siguiente/i); await page.waitForTimeout(2400);
    await click(page,/elegir aventura/i); await page.waitForTimeout(700);
    // WORLD: all 10 visible?
    const cards = page.locator("main button:has(img)");
    const worldN = await cards.count();
    const lastBox = await cards.nth(worldN-1).boundingBox(); // in normal flow (scrollable), not a dead canvas
    const lastReachable = !!lastBox && lastBox.height > 0;
    await page.screenshot({path:`/tmp/p2-${vp}-world.png`, fullPage:true});
    await click(page,/espacial|espac/i); await page.waitForTimeout(600);
    await page.screenshot({path:`/tmp/p2-${vp}-c1.png`, fullPage:true});
    await click(page,/robot perdido/i); await page.waitForTimeout(600);
    await page.screenshot({path:`/tmp/p2-${vp}-c2.png`, fullPage:true});
    await click(page,/fábrica flotante/i); await page.waitForTimeout(600);
    await page.screenshot({path:`/tmp/p2-${vp}-c3.png`, fullPage:true});
    // breadcrumb count should be 3 (world, c1, c2) at c3
    const crumbs = await page.locator("main nav button").count();
    await click(page,/imán|iman/i); await page.waitForTimeout(600);
    await page.screenshot({path:`/tmp/p2-${vp}-end.png`, fullPage:true});
    const finishVisible = await page.locator("button",{hasText:/escribir la dedicatoria/i}).first().isVisible();
    console.log(`[${vp}] worldOptions=${worldN} lastReachable=${lastReachable} crumbsAtC3=${crumbs} finish=${finishVisible} errors=${JSON.stringify(errs.slice(0,5))}`);
    expect(worldN).toBe(10);
    expect(lastReachable).toBeTruthy();   // all templates reachable (scroll on mobile)
    expect(finishVisible).toBeTruthy();
    expect(errs).toEqual([]);
  });
}
