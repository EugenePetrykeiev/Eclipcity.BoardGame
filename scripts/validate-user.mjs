import { chromium } from "playwright";

const userId = "123e4567-e89b-12d3-a456-426614174000";
const url = process.env.ECLIPCITY_USER_URL || `http://127.0.0.1:5173/user/${userId}`;
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

await page.route("http://127.0.0.1:8000/users/**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: userId,
      username: "runner_2150",
      email: "runner@example.com",
      email_verified: true,
      avatar_url: null,
      created_at: "2026-07-08T12:00:00Z"
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

await page.getByRole("button", { name: "Створити лоббі" }).click();
const toastVisible = await page
  .getByText("Викликано дію: створити лоббі.")
  .isVisible();

await page.getByRole("button", { name: /Вимкнути звуки/ }).click();
const soundToastVisible = await page.getByText("Звуки вимкнено.").isVisible();

await page.screenshot({
  fullPage: true,
  path: "/private/tmp/eclipcity-user-page.png"
});

await browser.close();

console.log(
  JSON.stringify(
    {
      url,
      mobileMetrics,
      toastVisible,
      soundToastVisible,
      consoleErrors
    },
    null,
    2
  )
);
