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

await page.route("**/users/**", async (route) => {
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

const lobbyPayload = {
  id: "223e4567-e89b-12d3-a456-426614174111",
  code: "R7K2Q",
  name: "Run#7",
  max_players: 5,
  player_count: 1,
  is_public: true,
  status: "waiting",
  created_at: "2026-07-09T12:00:00Z",
  players: [
    {
      user_id: userId,
      nickname: "runner_2150",
      team_color: "green",
      is_host: true,
      joined_at: "2026-07-09T12:00:00Z"
    }
  ],
  events: [
    {
      id: "323e4567-e89b-12d3-a456-426614174222",
      event_type: "created",
      message: 'runner_2150 створив лоббі "Run#7".',
      created_at: "2026-07-09T12:00:00Z"
    }
  ],
  is_member: true,
  is_host: true,
  path: "/lobby/R7K2Q"
};

await page.route("**/lobbies", async (route) => {
  if (route.request().method() !== "POST") {
    await route.fallback();
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(lobbyPayload)
  });
});

await page.route("**/lobbies/R7K2Q", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(lobbyPayload)
  });
});

await page.route("**/lobbies/R7K2Q/leave", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      message: "Lobby left.",
      next: `/user/${userId}`
    })
  });
});

await page.route("**/games/active", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ game: null })
  });
});

await page.goto(url, { waitUntil: "networkidle" });

async function collectMobileMetrics() {
  return page.evaluate(() => {
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
}

await page.getByRole("button", { name: "Почати гру" }).click();
await page.getByRole("button", { name: "Створити гру" }).click();
await page.getByRole("textbox", { name: "Назва лоббі" }).fill("Run#7");
await page.getByRole("button", { name: "Створити", exact: true }).click();
await page.locator(".lobby-code-badge").waitFor({ state: "visible" });

const lobbyVisible = await page.getByRole("heading", { name: "Run#7" }).isVisible();
const lobbyUserVisible = await page.getByRole("cell", { name: "runner_2150" }).isVisible();
const lobbyStartVisible = await page.getByRole("button", { name: "Старт" }).isVisible();
const startGameLabelVisible = await page
  .getByRole("button", { name: "Лоббі створено" })
  .isVisible();
const lobbyCodeVisible = await page
  .locator(".lobby-code-badge")
  .filter({ hasText: "ID: R7K2Q" })
  .isVisible();

await page.getByRole("button", { name: "Налаштування" }).click();
const settingsDialog = page.getByRole("dialog", { name: "Налаштування" });
const settingsVisible = await settingsDialog.isVisible();
const soundSwitch = settingsDialog.getByRole("switch", { name: "Звуки" });
const soundSwitchVisible = await soundSwitch.isVisible();
await soundSwitch.click();
const soundToastVisible = await page.getByText("Звуки вимкнено.").isVisible();
await soundSwitch.click();
await settingsDialog.getByRole("slider", { name: "Гучність" }).fill("24");
const audioCookiesStored = await page.evaluate(() => {
  const cookies = new Map(
    document.cookie.split(";").map((cookie) => {
      const [name, value] = cookie.trim().split("=");
      return [name, value];
    })
  );
  return (
    cookies.get("eclipcity_sound_enabled") === "true" &&
    cookies.get("eclipcity_sound_volume") === "0.24"
  );
});
await page.screenshot({
  fullPage: true,
  path: "/private/tmp/eclipcity-settings-mobile.png"
});
await settingsDialog.getByRole("button", { name: "Закрити" }).click();

await page.getByRole("button", { name: "Покинути лоббі" }).click();
await page.getByText("Тут буде персональний профіль гравця").waitFor({
  state: "visible"
});
const profileMockVisible = await page
  .getByText("Тут буде персональний профіль гравця")
  .isVisible();
await page.getByRole("button", { name: "Почати гру" }).waitFor({ state: "visible" });
const startGameResetVisible = await page
  .getByRole("button", { name: "Почати гру" })
  .isVisible();

await page.getByRole("button", { name: "EN" }).click();
const englishStartVisible = await page
  .getByRole("button", { name: "Start game" })
  .isVisible();

const mobileMetrics = await collectMobileMetrics();
const requiredChecks = {
  lobbyVisible,
  lobbyUserVisible,
  lobbyStartVisible,
  startGameLabelVisible,
  lobbyCodeVisible,
  settingsVisible,
  soundSwitchVisible,
  audioCookiesStored,
  profileMockVisible,
  startGameResetVisible,
  soundToastVisible,
  englishStartVisible,
  noConsoleErrors: consoleErrors.length === 0,
  noMobileOverflow: mobileMetrics.offenders.length === 0
};

const failedChecks = Object.entries(requiredChecks)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (failedChecks.length > 0) {
  throw new Error(`User page validation failed: ${failedChecks.join(", ")}`);
}

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
      lobbyVisible,
      lobbyUserVisible,
      lobbyStartVisible,
      startGameLabelVisible,
      lobbyCodeVisible,
      settingsVisible,
      soundSwitchVisible,
      audioCookiesStored,
      profileMockVisible,
      startGameResetVisible,
      soundToastVisible,
      englishStartVisible,
      consoleErrors
    },
    null,
    2
  )
);
