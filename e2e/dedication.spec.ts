import { test, expect } from "@playwright/test";
async function click(page, re: RegExp){const b=page.locator("button",{hasText:re}).first();await b.waitFor({state:"visible",timeout:15000});await b.click();}
const VPS={desktop:{width:1440,height:900},mobile:{width:390,height:844}};
for(const [vp,size] of Object.entries(VPS)){
  test(`dedication ${vp}`, async ({ page }) => {
    test.setTimeout(120000);
    const errs:string[]=[]; page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
    await page.setViewportSize(size);
    await page.goto("/es/crear",{waitUntil:"networkidle"});
    await page.getByPlaceholder("Ej: Leo").fill("Martina");
    await click(page,/siguiente/i); await page.waitForTimeout(2400);
    await click(page,/elegir aventura/i); await page.waitForTimeout(600);
    await click(page,/espacial|espac/i); await page.waitForTimeout(500);
    await click(page,/robot perdido/i); await page.waitForTimeout(500);
    await click(page,/fábrica flotante/i); await page.waitForTimeout(500);
    await click(page,/imán|iman/i); await page.waitForTimeout(500);
    await click(page,/escribir la dedicatoria/i); await page.waitForTimeout(900);
    await page.screenshot({path:`/tmp/ded2-${vp}.png`, fullPage:true});
    // last ending option must not be hidden behind the sticky footer
    const labels = page.locator('main label:has(input[name="ending"])');
    const last = labels.nth(await labels.count()-1);
    const lb = await last.boundingBox();
    const footer = page.locator('.sticky.bottom-0, [class*="sticky"][class*="bottom-0"]').last();
    const fb = await footer.boundingBox();
    const overlap = lb && fb ? (lb.y + lb.height > fb.y && lb.y < fb.y + fb.height) : false;
    // placeholder gender-neutral check
    const ph = await page.locator('#dedication').getAttribute('placeholder');
    console.log(`[${vp}] lastEndingBottom=${lb?Math.round(lb.y+lb.height):'?'} footerTop=${fb?Math.round(fb.y):'?'} overlap=${overlap} placeholderStart="${ph?.split("\\n")[0]}" errors=${JSON.stringify(errs.slice(0,4))}`);
    expect(overlap).toBeFalsy();
    expect(ph?.startsWith("Querido")).toBeFalsy();
  });
}
