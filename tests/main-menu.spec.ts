import { expect, test, type Page } from "@playwright/test";
import { openStartScreen } from "./menu-navigation";

const AUDIO_KEY = "impressario.audio-settings.v2";
const DISPLAY_KEY = "impressario.display-settings.v1";
const menu = (page: Page) => page.getByRole("region", { name: "Main menu" });

async function openSettings(page: Page): Promise<void> {
  await menu(page).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(menu(page).getByRole("heading", { name: "Settings" })).toBeVisible();
}

test("reloads and settings do not initialize Turnstile or consume run starts", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || url.hostname === "challenges.cloudflare.com") {
      requests.push(`${request.method()} ${url.pathname}`);
    }
  });
  await page.route("**/api/config", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ turnstileSiteKey: "test-site-key", buildVersion: "menu-test" })
  }));
  await page.route("https://challenges.cloudflare.com/**", route => route.fulfill({
    contentType: "application/javascript",
    body: `window.turnstile = {
      render(container) { container.textContent = 'Verification test fixture'; return 'test-widget'; },
      reset() {}
    };`
  }));

  // Use the same non-local host as the existing ranked-run tests.
  await page.goto("http://0.0.0.0:4173/");
  for (let reload = 0; reload < 3; reload += 1) {
    await expect(menu(page)).toBeVisible();
    await expect(page.locator(".leaderboard-overlay")).toHaveCount(0);
    await openSettings(page);
    await menu(page).getByRole("button", { name: "Back", exact: true }).click();
    expect(requests).toEqual([]);
    expect(await page.evaluate(() =>
      performance.getEntriesByType("resource").filter(entry =>
        /\/assets\/audio\//.test(entry.name)
      ).length
    )).toBe(0);
    expect(await page.evaluate(() => typeof window.__IMPRESSARIO_AUDIO_DEBUG__))
      .toBe("undefined");
    await page.reload();
  }

  await openStartScreen(page);
  await expect(page.getByText("Verification test fixture", { exact: true })).toBeVisible();
  expect(requests.filter(request => request === "GET /api/config")).toHaveLength(1);
  expect(requests.filter(request => request === "POST /api/runs")).toHaveLength(0);
  expect(requests.filter(request => request.includes("/turnstile/"))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("claim verification panel rejects malformed input without starting a run", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      requests.push(`${request.method()} ${url.pathname}`);
    }
  });

  await page.goto("/");
  const region = menu(page);
  await region.getByRole("button", {
    name: "Verify Claim Code",
    exact: true
  }).click();
  await expect(region.getByRole("heading", {
    name: "Verify Claim Code"
  })).toBeVisible();
  await region.getByRole("textbox", {
    name: "Claim code"
  }).fill("not-a-code");
  await region.getByRole("button", {
    name: "Verify",
    exact: true
  }).click();
  await expect(region.locator(".main-menu-status"))
    .toHaveAttribute("data-state", "invalid-format");
  await expect(region.locator(".main-menu-status"))
    .toHaveText("Enter a 16-character claim code.");
  expect(requests).toEqual([]);
});

test("claim verification distinguishes not-found and rate-limited responses", async ({ page }) => {
  await page.route("**/api/claims/verify", async route => {
    const body = route.request().postDataJSON() as {
      code: string;
    };
    const rateLimited = body.code.startsWith("2345");
    await route.fulfill({
      status: rateLimited ? 429 : 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: rateLimited
          ? "Too many verification attempts. Please wait one minute and try again."
          : "Code not found"
      })
    });
  });

  await page.goto("/");
  const region = menu(page);
  await region.getByRole("button", {
    name: "Verify Claim Code",
    exact: true
  }).click();
  const input = region.getByRole("textbox", {
    name: "Claim code"
  });
  const submit = region.getByRole("button", {
    name: "Verify",
    exact: true
  });

  await input.fill("ABCD-EFGH-JKLM-NPQR");
  await submit.click();
  await expect(region.locator(".main-menu-status"))
    .toHaveAttribute("data-state", "not-found");
  await expect(region.locator(".main-menu-status"))
    .toHaveText("Code not found.");

  await input.fill("2345-6789-ABCD-EFGH");
  await submit.click();
  await expect(region.locator(".main-menu-status"))
    .toHaveAttribute("data-state", "rate-limited");
  await expect(region.locator(".main-menu-status"))
    .toHaveText("Too many attempts. Wait one minute and try again.");
  await expect(submit).toBeEnabled();
});

test("claim verification deep link prefills, resolves, and removes the code without starting a run", async ({ page }) => {
  const runStarts: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/runs") {
      runStarts.push(url.pathname);
    }
  });
  await page.route("**/api/claims/verify", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      rank: 3,
      playerName: "Midnight Player",
      elapsedMs: 123456,
      rankedMs: 173456,
      deaths: 1,
      hits: 1,
      buildVersion: "0.7.0",
      completedAt: 1795000000000
    })
  }));

  await page.goto("/?verify=abcd-efgh-jklm-npqr");
  const region = menu(page);
  await expect(region.getByRole("heading", {
    name: "Verify Claim Code"
  })).toBeVisible();
  await expect(region.getByRole("textbox", {
    name: "Claim code"
  })).toHaveValue("ABCD-EFGH-JKLM-NPQR");
  await expect(region.locator(".main-menu-status"))
    .toHaveAttribute("data-state", "success");
  await expect(region.locator(".main-menu-verification-summary"))
    .toContainText("Midnight Player");
  await expect(region.locator(".main-menu-verification-summary"))
    .toContainText("0.7.0");
  await expect(page).toHaveURL("/");
  expect(runStarts).toEqual([]);
  await expect(region).not.toContainText(/unused|unclaimed/i);
});

test("native volume controls preserve audio v2 values across settings, reload and gameplay", async ({ page }) => {
  await page.goto("/");
  await expect(menu(page)).toBeVisible();
  const seed = {
    master: { volume: 1, muted: false },
    music: { volume: 0.32, muted: true },
    ambience: { volume: 0.23, muted: false },
    sfx: { volume: 0.47, muted: false },
    voice: { volume: 0.65, muted: true }
  };
  await page.evaluate(([key, value]) => localStorage.setItem(key, value),
    [AUDIO_KEY, JSON.stringify(seed)]);
  await page.reload();
  await openSettings(page);
  const music = menu(page).getByRole("slider", { name: "Music volume", exact: true });
  const sfx = menu(page).getByRole("slider", { name: "SFX volume", exact: true });
  await expect(music).toHaveValue("32");
  await expect(sfx).toHaveValue("47");
  await music.focus();
  await music.press("ArrowRight");
  await sfx.focus();
  await sfx.press("Home");
  await expect(music).toHaveValue("33");
  await expect(sfx).toHaveValue("0");
  const expected = { ...seed, music: { volume: 0.33, muted: true }, sfx: { volume: 0, muted: false } };
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), AUDIO_KEY))
    .toEqual(expected);
  await menu(page).getByRole("button", { name: "Back", exact: true }).click();
  await openSettings(page);
  await expect(music).toHaveValue("33");
  await page.reload();
  await openSettings(page);
  await expect(music).toHaveValue("33");
  await expect(sfx).toHaveValue("0");
  await menu(page).getByRole("button", { name: "Back", exact: true }).click();
  await openStartScreen(page);
  await page.getByRole("textbox").fill("Menu Settings");
  await page.getByRole("button", { name: "BEGIN THE SHOW" }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    window.__IMPRESSARIO_AUDIO_DEBUG__?.().busStates
  )).toMatchObject({
    music: { configuredGain: 0.33, muted: true, effectiveGain: 0 },
    sfx: { configuredGain: 0, muted: false, effectiveGain: 0 },
    ambience: { configuredGain: 0.23, muted: false },
    voice: { configuredGain: 0.65, muted: true }
  });
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("menu can be navigated with keyboard without leaking controls into gameplay", async ({ page }) => {
  await page.goto("/");
  const start = menu(page).getByRole("button", { name: "Start Game", exact: true });
  await expect(start).toBeFocused();
  await start.press("Tab");
  const settings = menu(page).getByRole("button", { name: "Settings", exact: true });
  await expect(settings).toBeFocused();
  await settings.press("Enter");
  await expect(menu(page).getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();
  await settings.press("Shift+Tab");
  await start.press("Enter");
  const overlay = page.locator(".leaderboard-overlay");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("textbox").fill("Menu Keyboard");
  await overlay.getByRole("button", { name: "BEGIN THE SHOW" }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => typeof window.__IMPRESSARIO_AUDIO_DEBUG__))
    .toBe("function");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("fullscreen toggles persist separately and browser exit updates the button", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await openSettings(page);
  const display = menu(page).getByRole("button", { name: "Display mode: Windowed", exact: true });
  await expect(display).toBeEnabled();
  await display.click();
  const fullscreen = menu(page).getByRole("button", { name: "Display mode: Fullscreen", exact: true });
  await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DISPLAY_KEY))
    .toEqual({ fullscreen: true });
  // Also cover an exit initiated outside the menu (e.g. browser Escape).
  await page.evaluate(() => document.exitFullscreen());
  await expect(display).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DISPLAY_KEY))
    .toEqual({ fullscreen: false });
  await display.click();
  await expect(fullscreen).toBeVisible();
  await fullscreen.click();
  await expect(display).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), AUDIO_KEY)).toBeNull();
  expect(errors).toEqual([]);
});

test("saved fullscreen waits for Start Game and keeps the identity overlay visible", async ({ page }) => {
  await page.goto("/");
  await expect(menu(page)).toBeVisible();
  await page.evaluate(key => localStorage.setItem(key, '{"fullscreen":true}'), DISPLAY_KEY);
  await page.reload();
  await expect(menu(page)).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await openStartScreen(page);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement))
    .toBe(true);
  const overlay = page.locator(".leaderboard-overlay");
  await overlay.getByRole("textbox").fill("Menu Fullscreen");
  await overlay.getByRole("button", { name: "BEGIN THE SHOW" }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => typeof window.__IMPRESSARIO_AUDIO_DEBUG__))
    .toBe("function");
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
});

test("fullscreen denial is reported without corrupting preferences or rejecting globally", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error("Denied"));
  });
  await page.goto("/");
  await openSettings(page);
  await menu(page).getByRole("button", { name: "Display mode: Windowed", exact: true }).click();
  await expect(menu(page).locator("p.main-menu-status")).toHaveText("Display mode could not be changed. Try again.");
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), DISPLAY_KEY)).toBeNull();
  expect(errors).toEqual([]);
});

for (const mode of ["corrupt", "unavailable"] as const) {
  test(`menu audio controls fall back safely when storage is ${mode}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(({ mode, audioKey, displayKey }) => {
      if (mode === "corrupt") {
        localStorage.setItem(audioKey, "{not-json");
        localStorage.setItem(displayKey, "{not-json");
      } else {
        Object.defineProperty(window, "localStorage", {
          get() { throw new Error("Storage denied"); }
        });
      }
    }, { mode, audioKey: AUDIO_KEY, displayKey: DISPLAY_KEY });
    await page.goto("/");
    await openSettings(page);
    const music = menu(page).getByRole("slider", { name: "Music volume", exact: true });
    const sfx = menu(page).getByRole("slider", { name: "SFX volume", exact: true });
    await expect(music).toHaveValue("71");
    await expect(sfx).toHaveValue("80");
    await music.press("Home");
    await expect(music).toHaveValue("0");
    await sfx.press("End");
    await expect(sfx).toHaveValue("100");
    expect(errors).toEqual([]);
  });
}
