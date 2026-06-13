import { test, expect } from "@playwright/test";
async function click(page, re: RegExp){const b=page.locator("button",{hasText:re}).first();await b.waitFor({state:"visible",timeout:15000});await b.click();}
const VPS={desktop:{width:1440,height:900},mobile:{width:390,height:844}};
for(const [vp,size] of Object.entries(VPS)){
  test(`recommend + header ${vp}`, async ({ page }) => {
    test.setTimeout(120000);
    const errs:string[]=[]; page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
    await page.setViewportSize(size);
    await page.goto("/es/crear",{waitUntil:"networkidle"});
    await page.getByPlaceholder("Ej: Leo").fill("Aina");
    for(const re of [/espacio/i, /dinosaurios/i, /animales/i]){
      const b=page.locator("button",{hasText:re}).first();
      if(await b.count()) await b.click().catch(()=>{});
    }
    await page.waitForTimeout(400);
    await click(page,/siguiente/i);
    await page.waitForTimeout(2400);
    await click(page,/elegir aventura/i);
    await page.waitForTimeout(800);
    await page.screenshot({path:`/tmp/rec-${vp}-world.png`, fullPage:true});
    const badges = await page.locator("main").getByText(/Recomendado/).count();
    const hint = await page.locator("main").getByText(/destacado/i).count();
    const headerLabels = await page.locator("header").getByText(/Personaje|Aventura|Dedicatoria/).count();
    console.log(`[${vp}] badges=${badges} hint=${hint} headerLabels=${headerLabels} errors=${JSON.stringify(errs.slice(0,4))}`);
    expect(badges).toBeGreaterThan(0);
    expect(errs).toEqual([]);
  });
}
