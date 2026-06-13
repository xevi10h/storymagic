import { test, expect } from "@playwright/test";

async function clickByText(page, re: RegExp) {
  const btn = page.locator("button", { hasText: re }).first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click();
}

test("space tree real branching", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") logs.push(m.text()); });

  await page.goto("/es/crear", { waitUntil: "networkidle" });

  // 1. character: name
  await page.getByPlaceholder("Ej: Leo").fill("Leo");
  // footer next
  await clickByText(page, /siguiente/i);

  // 2. portrait reveal → continue
  // wait for revealed CTA (continueButton)
  await page.waitForTimeout(2500);
  const cont = page.locator("button", { hasText: /elegir aventura/i }).first();
  await cont.waitFor({ state: "visible", timeout: 20000 });
  await cont.click();

  // 3. PathBuilder world chooser
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/pb-world.png" });
  await clickByText(page, /espacial|espac/i); // choose Space template

  // c1 root question
  await page.waitForTimeout(700);
  const q_c1 = (await page.locator("h1, .font-display").allTextContents()).join(" | ");
  await page.screenshot({ path: "/tmp/pb-c1.png" });

  // choose robot (c1 option a)
  await clickByText(page, /robot perdido/i);
  await page.waitForTimeout(700);
  const q_robot = (await page.locator(".path-chapter h2").innerText()).replace(/\s+/g, " ").trim();
  const opts_robot = await page.locator(".cp-fanin").allInnerTexts();
  await page.screenshot({ path: "/tmp/pb-c2-robot.png" });

  // go back to c1
  await clickByText(page, /volver|atrás|atras/i);
  await page.waitForTimeout(600);

  // choose crystal (c1 option b)
  await clickByText(page, /cristal/i);
  await page.waitForTimeout(700);
  const q_crystal = (await page.locator(".path-chapter h2").innerText()).replace(/\s+/g, " ").trim();
  const opts_crystal = await page.locator(".cp-fanin").allInnerTexts();
  await page.screenshot({ path: "/tmp/pb-c2-crystal.png" });

  console.log("Q_C1:", q_c1);
  console.log("Q_ROBOT_C2:", q_robot);
  console.log("OPTS_ROBOT:", JSON.stringify(opts_robot.map(s=>s.split("\n")[0])));
  console.log("Q_CRYSTAL_C2:", q_crystal);
  console.log("OPTS_CRYSTAL:", JSON.stringify(opts_crystal.map(s=>s.split("\n")[0])));
  console.log("CONSOLE_ERRORS:", JSON.stringify(logs));

  // assertions: real branching
  expect(q_robot).toContain("Tin");
  expect(q_crystal).toContain("cristal");
  expect(q_robot).not.toEqual(q_crystal);
  expect(opts_robot.join()).not.toEqual(opts_crystal.join());
});
