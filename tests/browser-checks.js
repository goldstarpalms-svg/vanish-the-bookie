import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const url = process.env.TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const errors = [];
await mkdir("qa", { recursive: true });
let passed = 0;
const check = (name) => {
  passed++;
  console.log(`PASS ${name}`);
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1120 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".match-card").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator(".match-card").count(), 6);
  await page.screenshot({ path: "qa/home-desktop.png", fullPage: true });
  check("home loads 6 paginated demo matches without a runtime error");
  await page.getByLabel("Match date").selectOption("all");
  await page
    .locator(".sport-tabs")
    .getByRole("button", { name: /Basketball/ })
    .click();
  assert.equal(await page.locator(".match-card").count(), 3);
  assert.equal(await page.locator(".sport-basketball").count(), 3);
  check("sport and date filters work together");
  await page.getByLabel("Search matches").fill("Denver");
  assert.equal(await page.locator(".match-card").count(), 1);
  assert.ok(
    (await page.locator(".match-card").innerText()).includes("Denver Nuggets"),
  );
  check("search filters teams");
  await page.locator(".save-button").click();
  await page.reload({ waitUntil: "networkidle" });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vanish:saved")),
  );
  assert.ok(saved.includes("demo-den-phx"));
  await page.getByLabel("Match date").selectOption("all");
  await page.locator(".saved-filter").click();
  assert.equal(await page.locator(".match-card").count(), 1);
  check("saved matches persist across reloads and can be filtered");
  await page
    .locator(".match-card")
    .getByRole("button", { name: "Read analysis" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes("synthetic"));
  await dialog.getByRole("button", { name: "Model inputs" }).click();
  assert.equal(await dialog.locator(".input-table>div").count(), 4);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  check("analysis, model input tabs and keyboard close work");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Results", exact: true })
    .click();
  await page.getByText("No verified results. Yet.").waitFor();
  assert.equal(await page.locator(".results-table").count(), 0);
  await page.getByRole("button", { name: "Explore the demo archive" }).click();
  assert.equal(await page.locator(".results-table tbody tr").count(), 12);
  await page
    .locator(".result-filters")
    .getByRole("button", { name: "Lost", exact: true })
    .click();
  assert.ok((await page.locator(".results-table tbody tr").count()) > 0);
  assert.equal(await page.locator(".results-table tbody .won").count(), 0);
  check("verified results stay separate from the complete demo archive");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "vanish-demo-results.csv");
  check("filtered demo CSV downloads with an explicit demo filename");
  await page
    .locator(".result-filters")
    .getByRole("button", { name: "All results" })
    .click();
  await page.screenshot({ path: "qa/results-desktop.png", fullPage: true });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /The model/ })
    .click();
  const first = await page
    .locator(".lab-output .probability-row strong")
    .first()
    .innerText();
  const slider = page.getByRole("slider", { name: "Home expected goals" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const last = await page
    .locator(".lab-output .probability-row strong")
    .first()
    .innerText();
  assert.notEqual(first, last);
  assert.ok(await slider.evaluate((el) => el === document.activeElement));
  await page
    .locator(".lab-sports")
    .getByRole("button", { name: "Tennis" })
    .click();
  assert.equal(await page.locator(".lab-output .probability-row").count(), 2);
  check("model lab recalculates and range inputs retain keyboard focus");
  await page.screenshot({ path: "qa/model-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Join the conversation" }).click();
  assert.equal(
    await page.getByRole("link", { name: /Vanish on X/ }).getAttribute("href"),
    "https://x.com/vanishthebookie",
  );
  assert.ok(
    (await page.getByRole("dialog").innerText()).includes(
      "Invite link hasn’t been added yet.",
    ),
  );
  await page.getByLabel("Close dialog").click();
  check("X link is correct and missing WhatsApp invite is clearly marked");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Predictions", exact: true })
    .click();
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/demo/refresh"),
  );
  await page.getByLabel("Refresh demo predictions").click();
  assert.equal((await response).status(), 200);
  check("server-side recalculation endpoint works");
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(url, { waitUntil: "networkidle" });
  await mobile.locator(".match-card").first().waitFor();
  await mobile.evaluate(() => document.fonts.ready);
  let widths = await mobile.evaluate(() => [
    innerWidth,
    document.documentElement.scrollWidth,
  ]);
  assert.equal(widths[0], widths[1]);
  await mobile.screenshot({ path: "qa/home-mobile.png", fullPage: true });
  await mobile.getByLabel("Toggle navigation").click();
  await mobile
    .getByRole("navigation")
    .getByRole("button", { name: /The model/ })
    .click();
  await mobile.getByText("A reason behind every number.").waitFor();
  widths = await mobile.evaluate(() => [
    innerWidth,
    document.documentElement.scrollWidth,
  ]);
  assert.equal(widths[0], widths[1]);
  await mobile.screenshot({ path: "qa/model-mobile.png", fullPage: true });
  check("390px mobile navigation and pages render without horizontal overflow");
  assert.deepEqual(errors, []);
  check("no browser runtime errors");
  console.log(`\n${passed} browser checks passed.`);
} finally {
  await browser.close();
}
