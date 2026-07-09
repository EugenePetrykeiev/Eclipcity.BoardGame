import { chromium } from "playwright";

const url = process.env.ECLIPCITY_URL || "http://127.0.0.1:5173/";
const executablePath =
  process.env.CHROME_EXECUTABLE_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

await page.route("http://127.0.0.1:8000/auth/session", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      authenticated: false,
      user: null,
      next: null
    })
  });
});

await page.goto(url, { waitUntil: "networkidle" });

const mobileMetrics = await page.evaluate(() => {
  const width = document.documentElement.clientWidth;
  const offenders = [...document.body.querySelectorAll("*")]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        className: element.className,
        text: element.textContent.trim().slice(0, 80),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width)
      };
    })
    .filter((item) => item.right > width + 1 || item.left < -1);

  return {
    clientWidth: width,
    scrollWidth: document.documentElement.scrollWidth,
    offenders
  };
});

await page.getByRole("tab", { name: "Register" }).click();
await page.getByRole("button", { name: "Зареєструватися" }).click();
const validationVisible = await page
  .getByText("Введи коректний email.")
  .isVisible();

const usernameVisible = await page.locator('input[name="username"]').isVisible();
const googleButtonVisible = await page
  .getByRole("button", { name: /Google OAuth/ })
  .isVisible();

await page.screenshot({
  fullPage: true,
  path: "/private/tmp/eclipcity-validated-mobile.png"
});

await browser.close();

console.log(
  JSON.stringify(
    {
      url,
      mobileMetrics,
      validationVisible,
      usernameVisible,
      googleButtonVisible,
      consoleErrors
    },
    null,
    2
  )
);
