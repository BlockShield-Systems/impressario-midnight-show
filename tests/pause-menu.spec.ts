import {
  expect,
  test,
  type Page
} from "@playwright/test";
import { openStartScreen } from "./menu-navigation";

const AUDIO_KEY =
  "impressario.audio-settings.v2";
const DISPLAY_KEY =
  "impressario.display-settings.v1";

interface GameplaySnapshot {
  readonly player: {
    readonly x: number;
    readonly y: number;
  };
  readonly abilityHud: {
    readonly visible: boolean;
    readonly bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly lightText: string;
    readonly cardText: string;
    readonly showText: string;
  };
  readonly objectiveBanners: readonly {
    readonly text: string;
    readonly bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }[];
  readonly pauseMenuOpen: boolean;
}

interface GameplayHarness {
  setPlayerLocation(x: number, y: number): void;
  resumeGameplay(): void;
  snapshot(): GameplaySnapshot;
}

async function beginShow(
  page: Page
): Promise<void> {
  await page.goto("/");
  await openStartScreen(page);

  const overlay =
    page.locator(".leaderboard-overlay");
  await overlay.getByRole("textbox")
    .fill("Pause Menu QA");
  await overlay.getByRole(
    "button",
    { name: "BEGIN THE SHOW" }
  ).click();

  await expect(page.locator("canvas"))
    .toBeVisible({ timeout: 20_000 });
  await expect.poll(() =>
    page.evaluate(() =>
      typeof (
        window as Window & {
          __IMPRESSARIO_BOUNDARY_QA__?:
            GameplayHarness;
        }
      ).__IMPRESSARIO_BOUNDARY_QA__
    )
  ).toBe("object");
}

async function placePlayer(
  page: Page,
  x: number,
  y: number
): Promise<void> {
  await page.evaluate(
    ([nextX, nextY]) => {
      const harness = (
        window as Window & {
          __IMPRESSARIO_BOUNDARY_QA__?:
            GameplayHarness;
        }
      ).__IMPRESSARIO_BOUNDARY_QA__;
      harness?.setPlayerLocation(
        nextX,
        nextY
      );
      harness?.resumeGameplay();
    },
    [x, y]
  );
  await page.waitForTimeout(150);
}

async function snapshot(
  page: Page
): Promise<GameplaySnapshot> {
  const value = await page.evaluate(() =>
    (
      window as Window & {
        __IMPRESSARIO_BOUNDARY_QA__?:
          GameplayHarness;
      }
    ).__IMPRESSARIO_BOUNDARY_QA__
      ?.snapshot()
  );

  expect(value).toBeDefined();
  return value!;
}

function overlaps(
  left: GameplaySnapshot[
    "abilityHud"
  ]["bounds"],
  right: GameplaySnapshot[
    "objectiveBanners"
  ][number]["bounds"]
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

test("ability resources remain visible beside the longest objective banner", async ({ page }) => {
  await beginShow(page);

  await placePlayer(page, 23600, 322);
  await placePlayer(page, 31920, 354);
  await placePlayer(page, 23640, 322);

  await expect.poll(async () =>
    (await snapshot(page))
      .objectiveBanners.length
  ).toBeGreaterThan(0);

  const state = await snapshot(page);
  const spotlightObjective =
    state.objectiveBanners.find(
      banner => banner.text.includes(
        "SHOW recovers over time."
      )
    );

  expect(spotlightObjective).toBeDefined();
  expect(
    spotlightObjective!.text.split("\n")
      .some(line => line.length === 48)
  ).toBe(true);
  expect(state.abilityHud.visible).toBe(true);
  expect(state.abilityHud.lightText)
    .toBe("[K] SPOTLIGHT");
  expect(state.abilityHud.cardText)
    .toMatch(/^\[L\] CARD (?:[0-3]\/3|EMPTY)$/);
  expect(state.abilityHud.showText)
    .toMatch(/^SHOW \d+$/);
  expect(
    overlaps(
      state.abilityHud.bounds,
      spotlightObjective!.bounds
    )
  ).toBe(false);
});

test("P pauses in fullscreen and pause settings persist without gameplay input leakage", async ({ page }) => {
  await beginShow(page);

  const beforePause = await snapshot(page);
  await page.keyboard.press("p");

  const menu = page.getByRole(
    "region",
    { name: "Pause menu" }
  );
  await expect(menu).toBeVisible();
  await expect.poll(async () =>
    (await snapshot(page)).pauseMenuOpen
  ).toBe(true);

  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");

  const whilePaused = await snapshot(page);
  expect(whilePaused.player.x)
    .toBe(beforePause.player.x);
  expect(whilePaused.player.y)
    .toBe(beforePause.player.y);

  const music = menu.getByRole(
    "slider",
    { name: "Music volume" }
  );
  const sfx = menu.getByRole(
    "slider",
    { name: "SFX volume" }
  );

  await music.fill("37");
  await sfx.fill("26");
  await menu.getByRole(
    "button",
    { name: "Display mode: Windowed" }
  ).click();

  await expect.poll(() => page.evaluate(() =>
    document.fullscreenElement ===
      document.documentElement
  )).toBe(true);

  await page.keyboard.press("p");
  await expect(menu).toHaveCount(0);
  await expect.poll(async () =>
    (await snapshot(page)).pauseMenuOpen
  ).toBe(false);

  await page.keyboard.press("p");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole(
    "button",
    { name: "Display mode: Fullscreen" }
  )).toBeVisible();
  await expect(music).toHaveValue("37");
  await expect(sfx).toHaveValue("26");

  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() =>
    document.fullscreenElement
  )).toBeNull();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole(
    "button",
    { name: "Display mode: Windowed" }
  )).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  expect(await page.evaluate(key =>
    JSON.parse(localStorage.getItem(key)!),
  AUDIO_KEY)).toMatchObject({
    music: { volume: 0.37 },
    sfx: { volume: 0.26 }
  });
  expect(await page.evaluate(key =>
    JSON.parse(localStorage.getItem(key)!),
  DISPLAY_KEY)).toEqual({
    fullscreen: false
  });
});
