import {
  expect,
  test,
  type Page
} from "@playwright/test";
import { openStartScreen } from "./menu-navigation";

const SECTIONS = [
  ["MovementRehearsal", 0, 5376, "music_01_opening_rehearsal"],
  ["CombatRehearsal", 5376, 10464, "music_02_combat_rehearsal"],
  ["MainStage", 10464, 13744, "music_03_backstage_ambush"],
  ["GrandGallery", 13744, 19456, "music_04_grand_gallery"],
  ["GalleryGauntlet", 19456, 23552, "music_05_gallery_gauntlet"],
  ["SpotlightVault", 23552, 27984, "music_06_spotlight_vault"],
  ["CardSanctum", 27984, 31664, "music_07_card_sanctum"],
  ["RoyalBox", 31664, 35344, "music_08_royal_box"],
  ["MirrorCore", 35344, 39200, "music_09_mirror_core"],
  ["ConductorApproach", 39200, 44672, "music_09_mirror_core"],
  ["MirrorConductor", 44672, 49824, "music_10_conductor_phase_1"]
] as const;

interface BoundarySnapshot {
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly controllable: boolean;
  };
  readonly previousSectionId: string | null;
  readonly currentSectionId: string | null;
  readonly cameraSectionId: string | null;
  readonly sectionEnterCount: number;
  readonly sectionExitCount: number;
  readonly sectionTransitionCount: number;
  readonly playedVoiceCount: number;
  readonly activeListeners: number;
  readonly activeTimers: number;
  readonly activeTweens: number;
  readonly sceneObjects: number;
  readonly enemies: number;
  readonly hazards: number;
  readonly collisionChecks: number;
  readonly solidCount: number;
  readonly checkpoint: {
    readonly checkpointName: string;
    readonly checkpointX: number;
    readonly checkpointY: number;
    readonly controlsLocked: boolean;
    readonly currentHealth: number;
  };
  readonly soundtrack: {
    readonly currentSoundtrack: string | null;
    readonly soundtrackTransitionCount: number;
    readonly activeCrossfades: number;
  };
  readonly audio: {
    readonly activeHandles: readonly {
      readonly logicalKey: string;
      readonly bus: string;
    }[];
    readonly duplicateInstanceCounts: Readonly<Record<string, number>>;
    readonly currentDialogue: string | null;
    readonly loadingOwners: number;
    readonly lastLoadError: string | null;
  };
  readonly timing: {
    readonly fixedSteps: number;
    readonly maximumSteps: number;
    readonly maximumAccumulatorAfter: number;
    readonly maximumUpdateCostMilliseconds: number;
  };
  readonly accumulator: number;
  readonly runtimeErrors: readonly string[];
}

interface BoundaryHarness {
  readonly boundaries: readonly number[];
  setPlayerLocation(x: number, y: number): void;
  snapshot(): BoundarySnapshot;
}

declare global {
  interface Window {
    __IMPRESSARIO_BOUNDARY_QA__?: BoundaryHarness;
  }
}

async function beginShow(page: Page): Promise<void> {
  await page.goto("/");
  await openStartScreen(page);
  const overlay = page.locator(".leaderboard-overlay");
  await overlay.locator("input").first().fill("Boundary QA");
  await overlay.getByRole("button", {
    name: /BEGIN THE SHOW/i
  }).click();
  await expect(page.locator("canvas")).toBeVisible({
    timeout: 20_000
  });
  await expect.poll(() => page.evaluate(() =>
    typeof window.__IMPRESSARIO_BOUNDARY_QA__
  )).toBe("object");
}

async function moveTo(
  page: Page,
  x: number,
  expectedSection: string,
  expectedTheme: string
): Promise<void> {
  await page.evaluate(([nextX]) => {
    window.__IMPRESSARIO_BOUNDARY_QA__
      ?.setPlayerLocation(nextX, 120);
  }, [x]);

  await expect.poll(() => page.evaluate(() =>
    window.__IMPRESSARIO_BOUNDARY_QA__
      ?.snapshot().currentSectionId
  )).toBe(expectedSection);

  await expect.poll(() => page.evaluate(() =>
    window.__IMPRESSARIO_BOUNDARY_QA__
      ?.snapshot().audio.loadingOwners ?? -1
  ), { timeout: 20_000 }).toBe(0);

  await expect.poll(() => page.evaluate(() =>
    window.__IMPRESSARIO_BOUNDARY_QA__
      ?.snapshot().soundtrack.currentSoundtrack
  ), { timeout: 20_000 }).toBe(expectedTheme);
}

async function snapshot(
  page: Page
): Promise<BoundarySnapshot> {
  const result = await page.evaluate(() =>
    window.__IMPRESSARIO_BOUNDARY_QA__?.snapshot()
  );
  expect(result).toBeDefined();
  return result!;
}

test("all ten boundaries support repeated forward and backward traversal without freezes or growth", async ({ page }) => {
  test.setTimeout(900_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await beginShow(page);

  expect(await page.evaluate(() =>
    window.__IMPRESSARIO_BOUNDARY_QA__?.boundaries
  )).toEqual(SECTIONS.slice(0, -1).map(([, , endX]) => endX));

  const requestedBoundary =
    process.env.BOUNDARY_INDEX === undefined
      ? null
      : Number(process.env.BOUNDARY_INDEX);
  const boundaryIndexes =
    requestedBoundary === null
      ? SECTIONS.slice(0, -1).map((_, index) => index)
      : [requestedBoundary];

  for (const index of boundaryIndexes) {
    const [leftId, , boundary, leftTheme] = SECTIONS[index];
    const [rightId, , , rightTheme] = SECTIONS[index + 1];

    await moveTo(page, boundary - 2, leftId, leftTheme);
    await page.waitForTimeout(350);
    const stationaryBefore = await snapshot(page);
    await page.waitForTimeout(250);
    const stationaryAfter = await snapshot(page);

    expect(stationaryAfter.sectionTransitionCount)
      .toBe(stationaryBefore.sectionTransitionCount);
    expect(stationaryAfter.sectionEnterCount)
      .toBe(stationaryBefore.sectionEnterCount);
    expect(stationaryAfter.sectionExitCount)
      .toBe(stationaryBefore.sectionExitCount);

    await moveTo(page, boundary + 2, rightId, rightTheme);
    await page.waitForTimeout(350);
    const rightStationaryBefore = await snapshot(page);
    await page.waitForTimeout(250);
    const rightStationaryAfter = await snapshot(page);

    expect(rightStationaryAfter.sectionTransitionCount)
      .toBe(rightStationaryBefore.sectionTransitionCount);
    expect(rightStationaryAfter.sectionEnterCount)
      .toBe(rightStationaryBefore.sectionEnterCount);
    expect(rightStationaryAfter.sectionExitCount)
      .toBe(rightStationaryBefore.sectionExitCount);

    await moveTo(page, boundary - 2, leftId, leftTheme);
    const cycleStart = await snapshot(page);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await moveTo(page, boundary + 2, rightId, rightTheme);
      await page.waitForTimeout(80);
      await moveTo(page, boundary - 2, leftId, leftTheme);
      await page.waitForTimeout(80);
    }

    await page.waitForTimeout(1_350);
    const after = await snapshot(page);

    expect(after.currentSectionId).toBe(leftId);
    expect(after.previousSectionId).toBe(rightId);
    expect(after.cameraSectionId).toBe(leftId);
    expect(after.player.controllable).toBe(true);
    expect(after.sectionTransitionCount - cycleStart.sectionTransitionCount)
      .toBe(6);
    expect(after.sectionEnterCount - cycleStart.sectionEnterCount)
      .toBe(6);
    expect(after.sectionExitCount - cycleStart.sectionExitCount)
      .toBe(6);
    expect(after.soundtrack.currentSoundtrack).toBe(leftTheme);
    expect(after.soundtrack.activeCrossfades).toBe(0);
    expect(after.audio.activeHandles.filter(handle => handle.bus === "music"))
      .toHaveLength(1);
    expect(Object.values(after.audio.duplicateInstanceCounts)
      .every(count => count <= 1)).toBe(true);
    expect(after.audio.lastLoadError).toBeNull();
    expect(after.runtimeErrors).toEqual([]);
    expect(after.activeListeners).toBe(cycleStart.activeListeners);
    expect(after.activeTimers).toBeLessThanOrEqual(cycleStart.activeTimers + 1);
    expect(after.activeTweens).toBeLessThanOrEqual(cycleStart.activeTweens);
    expect(after.sceneObjects).toBe(cycleStart.sceneObjects);
    expect(after.enemies).toBe(cycleStart.enemies);
    expect(after.hazards).toBe(cycleStart.hazards);
    expect(after.solidCount).toBe(cycleStart.solidCount);
    expect(after.collisionChecks).toBe(cycleStart.collisionChecks);
    expect(after.checkpoint).toEqual(cycleStart.checkpoint);
    expect(after.playedVoiceCount).toBeLessThanOrEqual(10);
    expect(after.timing.fixedSteps).toBeGreaterThan(cycleStart.timing.fixedSteps);
    expect(after.timing.maximumSteps).toBeLessThanOrEqual(48);
    expect(after.timing.maximumAccumulatorAfter).toBeLessThan(1 / 120);
    expect(after.accumulator).toBeLessThan(1 / 120);

    console.info(`BOUNDARY_QA_${leftId}_${rightId}=${JSON.stringify({
      boundary,
      transitions: after.sectionTransitionCount - cycleStart.sectionTransitionCount,
      soundtrackTransitions:
        after.soundtrack.soundtrackTransitionCount -
        cycleStart.soundtrack.soundtrackTransitionCount,
      listeners: after.activeListeners,
      timers: after.activeTimers,
      tweens: after.activeTweens,
      objects: after.sceneObjects,
      collisionChecks: after.collisionChecks,
      fixedSteps: after.timing.fixedSteps - cycleStart.timing.fixedSteps,
      maximumUpdateMs: after.timing.maximumUpdateCostMilliseconds,
      accumulator: after.accumulator
    })}`);
  }

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
