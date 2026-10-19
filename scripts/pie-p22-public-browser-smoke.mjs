import { chromium } from "playwright";

const target = process.env.PRODUCTION_URL;
if (!target || !target.startsWith("https://")) {
  throw new Error("PRODUCTION_URL must be set to an HTTPS URL");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1365, height: 900 },
    deviceScaleFactor: 1,
  });
  const assetFailures = [];
  page.on("response", (response) => {
    const url = response.url();
    if (/\.(?:js|css)(?:\?|$)/i.test(url) && response.status() !== 200) {
      assetFailures.push({ status: response.status(), url });
    }
  });

  const response = await page.goto(target, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  const finalUrl = page.url();
  const status = response?.status() ?? 0;
  const title = await page.title();
  const rootExists = await page.locator("#root").count().then((n) => n > 0);
  const titleValid = /zyntra/i.test(title);

  console.log("Final URL: " + finalUrl);
  console.log("Navigation status: " + status);
  console.log("Document title: " + title);
  console.log("Application root present: " + rootExists);
  console.log("JavaScript/CSS asset failures: " + assetFailures.length);

  if (!finalUrl.startsWith("https://")) throw new Error("Final browser URL is not HTTPS");
  if (status !== 200) {
    const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
    throw new Error("Expected HTTP 200, received " + status + "; page body: " + body);
  }
  if (!titleValid) throw new Error("Expected a Zyntra page title");
  if (!rootExists) throw new Error("Application root #root is missing");
  if (assetFailures.length) throw new Error("Non-200 JavaScript/CSS assets: " + JSON.stringify(assetFailures));

  console.log("PASS public browser smoke: HTTPS, HTTP 200, Zyntra title, app root, and JS/CSS responses");
} finally {
  await browser.close();
}
