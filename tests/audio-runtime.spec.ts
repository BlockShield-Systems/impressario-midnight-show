import {
  expect,
  test,
  type Page
} from "@playwright/test";

interface ActiveAudioHandle {
  readonly logicalKey: string;
  readonly bus: string;
  readonly gain: number;
  readonly effectiveGain: number;
  readonly playbackPosition: number;
  readonly duration: number;
  readonly isPlaying: boolean;
}

interface AudioDebugSnapshot {
  readonly activeSounds: number;
  readonly activeLoops: number;
  readonly loadingOwners: number;
  readonly cachedOwners: number;
  readonly totalOwners: number;
  readonly contextState: string;
  readonly preparedContextInUse: boolean;
  readonly soundManagerLocked: boolean;
  readonly currentSoundtrack: string | null;
  readonly currentAmbience: string | null;
  readonly currentBossThemePart: number | null;
  readonly currentDialogue: string | null;
  readonly activeHandles: readonly ActiveAudioHandle[];
  readonly duplicateInstanceCounts: Readonly<Record<string, number>>;
  readonly playbackHistory: {
    readonly started: Readonly<Record<string, number>>;
    readonly completed: Readonly<Record<string, number>>;
    readonly stopped: Readonly<Record<string, number>>;
  };
  readonly soundtrackRequests: Readonly<Record<string, number>>;
  readonly busStates: Readonly<Record<string, {
    readonly muted: boolean;
    readonly configuredGain: number;
    readonly effectiveGain: number;
  }>>;
  readonly finalOutput: {
    readonly contextMatchesDestination: boolean;
    readonly phaserDestinationMatchesContext: boolean;
    readonly masterMuted: boolean;
    readonly masterGain: number;
    readonly effectiveGain: number;
    readonly analyserInFinalOutputPath: boolean;
  };
  readonly analyser: {
    readonly rms: number;
    readonly peak: number;
    readonly observedRms: number;
    readonly observedPeak: number;
  };
  readonly lastLoadError: string | null;
  readonly timing: {
    readonly wallSeconds: number;
    readonly rawSeconds: number;
    readonly acceptedSeconds: number;
    readonly discardedSeconds: number;
    readonly fixedSteps: number;
    readonly maximumSteps: number;
    readonly maximumAccumulatorBefore: number;
    readonly maximumAccumulatorAfter: number;
    readonly averageUpdateCostMilliseconds: number;
    readonly maximumUpdateCostMilliseconds: number;
    readonly longTaskCount: number;
    readonly maximumLongTaskMilliseconds: number;
    readonly wallToGameRatio: number;
    readonly playerDisplacement: number;
  };
}

declare global {
  interface Window {
    __IMPRESSARIO_AUDIO_DEBUG__?:
      () => AudioDebugSnapshot;
  }
}

const SECTION_THEME_MATRIX = [
  ["MovementRehearsal", "music_01_opening_rehearsal"],
  ["CombatRehearsal", "music_02_combat_rehearsal"],
  ["MainStage", "music_03_backstage_ambush"],
  ["GrandGallery", "music_04_grand_gallery"],
  ["GalleryGauntlet", "music_05_gallery_gauntlet"],
  ["SpotlightVault", "music_06_spotlight_vault"],
  ["CardSanctum", "music_07_card_sanctum"],
  ["RoyalBox", "music_08_royal_box"],
  ["MirrorCore", "music_09_mirror_core"],
  ["ConductorApproach", "music_09_mirror_core"],
  ["MirrorConductor", "music_10_conductor_phase_1"]
] as const;

const BOSS_THEMES = [
  "music_10_conductor_phase_1",
  "music_11_conductor_phase_2",
  "music_12_conductor_phase_3"
] as const;

const ALL_UNIQUE_THEMES = [
  ...new Set([
    ...SECTION_THEME_MATRIX.map(
      ([, id]) => id
    ),
    ...BOSS_THEMES,
    "music_13_finale"
  ])
] as const;

async function beginShow(
  page: Page,
  query: string,
  playerName: string
): Promise<void> {
  await page.goto(`/${query}`);

  expect(
    await page.evaluate(() =>
      typeof window.__IMPRESSARIO_AUDIO_DEBUG__
    )
  ).toBe("undefined");

  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter(entry =>
          /\/assets\/audio\//.test(entry.name)
        ).length
    )
  ).toBe(0);

  const overlay =
    page.locator(".leaderboard-overlay");
  await expect(overlay).toBeVisible();
  await overlay.locator("input").first()
    .fill(playerName);

  const beginButton = overlay.getByRole(
    "button",
    { name: /BEGIN THE SHOW/i }
  );
  await expect(beginButton).toBeEnabled();

  /* This must be the only WebAudio-unlock gesture. */
  await beginButton.click();
  await expect(page.locator("canvas"))
    .toBeVisible({ timeout: 20_000 });

  await expect.poll(
    () => page.evaluate(() =>
      typeof window.__IMPRESSARIO_AUDIO_DEBUG__
    )
  ).toBe("function");

  await expect.poll(
    () => page.evaluate(() =>
      window.__IMPRESSARIO_AUDIO_DEBUG__?.()
        .loadingOwners ?? -1
    ),
    { timeout: 20_000 }
  ).toBe(0);
}

async function snapshot(
  page: Page
): Promise<AudioDebugSnapshot> {
  const result = await page.evaluate(() =>
    window.__IMPRESSARIO_AUDIO_DEBUG__?.()
  );

  expect(result).toBeDefined();
  return result!;
}

async function beginRankedRaceRun(
  page: Page,
  startStatus: number
): Promise<{
  readonly requests: string[];
  readonly pageErrors: string[];
}> {
  const requests: string[] = [];
  const pageErrors: string[] = [];

  page.on("pageerror", error => {
    pageErrors.push(error.message);
  });
  page.on("request", request => {
    const url = new URL(request.url());

    if (url.pathname.startsWith("/api/")) {
      requests.push(
        `${request.method()} ${url.pathname}`
      );
    }
  });

  await page.route("**/api/config", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        turnstileSiteKey: "",
        buildVersion: "race-test"
      })
    })
  );
  await page.route("**/api/runs", async route => {
    await new Promise(resolve =>
      setTimeout(resolve, 500)
    );

    if (startStatus >= 400) {
      await route.fulfill({
        status: startStatus,
        contentType: "application/json",
        body: JSON.stringify({
          error: "deterministic test failure"
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        runId: "race-run",
        token: "race-token",
        playerName: "Race Tester",
        startedAt: Date.now()
      })
    });
  });

  await page.goto("http://0.0.0.0:4173/");
  const overlay = page.locator(
    ".leaderboard-overlay"
  );
  const input = overlay.locator(
    "input.leaderboard-name"
  );
  const beginButton = overlay.getByRole(
    "button",
    { name: "BEGIN THE SHOW" }
  );

  await input.fill("Race Tester");
  await expect(beginButton).toBeEnabled();

  const retainedButton =
    await beginButton.elementHandle();

  await beginButton.click();
  await retainedButton?.evaluate(button => {
    button.click();
  });

  await expect(page.locator("canvas"))
    .toBeVisible({ timeout: 20_000 });
  await expect(page.locator("canvas"))
    .toHaveCount(1);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await page.waitForTimeout(800);

  return {
    requests,
    pageErrors
  };
}

async function proveCatalogPlayback(
  page: Page,
  id: string,
  family: string
): Promise<void> {
  await beginShow(
    page,
    `?qaAudio=${id}`,
    `Qa${family}`
  );

  await expect.poll(
    () => page.evaluate(
      key => window.__IMPRESSARIO_AUDIO_DEBUG__?.()
        .playbackHistory.started[key] ?? 0,
      id
    ),
    { timeout: 20_000 }
  ).toBeGreaterThan(0);

  await expect.poll(
    () => page.evaluate(() =>
      window.__IMPRESSARIO_AUDIO_DEBUG__?.()
        .analyser.observedPeak ?? 0
    ),
    { timeout: 10_000 }
  ).toBeGreaterThan(0.00001);

  const evidence = await snapshot(page);
  expect(evidence.contextState).toBe("running");
  expect(evidence.preparedContextInUse).toBe(true);
  expect(evidence.soundManagerLocked).toBe(false);
  expect(evidence.lastLoadError).toBeNull();
  expect(evidence.finalOutput.contextMatchesDestination)
    .toBe(true);
  expect(evidence.finalOutput.phaserDestinationMatchesContext)
    .toBe(true);
  expect(evidence.finalOutput.masterMuted)
    .toBe(false);
  expect(evidence.finalOutput.effectiveGain)
    .toBeGreaterThan(0);
  expect(evidence.finalOutput.analyserInFinalOutputPath)
    .toBe(true);
  expect(evidence.busStates.master.effectiveGain)
    .toBeGreaterThan(0);
  expect(
    Object.values(evidence.duplicateInstanceCounts)
      .every(count => count <= 1)
  ).toBe(true);
}

test(
  "ranked startup creates one game and one delayed online session",
  async ({ page }) => {
    const { requests, pageErrors } =
      await beginRankedRaceRun(page, 200);

    expect(requests.filter(request =>
      request === "GET /api/config"
    )).toHaveLength(1);
    expect(requests.filter(request =>
      request === "POST /api/runs"
    )).toHaveLength(1);
    expect(requests.some(request =>
      /\/events$|\/finish$/.test(request)
    )).toBe(false);
    expect(pageErrors).toEqual([]);
  }
);

test(
  "ranked session failure stays unranked without retrying or stopping gameplay",
  async ({ page }) => {
    const { requests, pageErrors } =
      await beginRankedRaceRun(page, 503);

    expect(requests.filter(request =>
      request === "GET /api/config"
    )).toHaveLength(1);
    expect(requests.filter(request =>
      request === "POST /api/runs"
    )).toHaveLength(1);
    expect(requests.some(request =>
      /\/events$|\/finish$/.test(request)
    )).toBe(false);
    expect(pageErrors).toEqual([]);
  }
);

test(
  "BEGIN THE SHOW unlocks the prepared context and every representative family produces signal",
  async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedAudioRequests: string[] = [];

    page.on("pageerror", error => {
      pageErrors.push(error.message);
    });
    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("requestfailed", request => {
      if (/\/assets\/audio\/.*\.(?:ogg|mp3)(?:\?|$)/i.test(request.url())) {
        failedAudioRequests.push(
          `${request.url()}: ${request.failure()?.errorText ?? "unknown"}`
        );
      }
    });
    page.on("response", response => {
      if (
        /\/assets\/audio\/.*\.(?:ogg|mp3)(?:\?|$)/i.test(response.url()) &&
        response.status() >= 400
      ) {
        failedAudioRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    for (const [id, family] of [
      ["player_jump", "Movement"],
      ["cane_swing_01", "Combat"],
      ["stagehand_alert", "Enemy"],
      ["world_checkpoint", "CheckpointUi"],
      ["vo_opening", "Voice"],
      ["finale_firework_01", "Finale"]
    ] as const) {
      await proveCatalogPlayback(page, id, family);
    }

    expect(failedAudioRequests, failedAudioRequests.join("\n"))
      .toEqual([]);
    expect(pageErrors, pageErrors.join("\n"))
      .toEqual([]);
    expect(consoleErrors, consoleErrors.join("\n"))
      .toEqual([]);
  }
);

test(
  "first sixty playable seconds remain synchronized without retained fixed-step backlog",
  async ({ page }) => {
    test.setTimeout(90_000);
    await beginShow(
      page,
      "?qaAudio=player_jump",
      "QaTiming"
    );

    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(60_000);
    await page.keyboard.up("ArrowRight");

    const evidence = await snapshot(page);
    const timing = evidence.timing;

    console.info(
      `QA_TIMING_SNAPSHOT=${JSON.stringify(timing)}`
    );

    expect(timing.wallSeconds).toBeGreaterThanOrEqual(59);
    expect(timing.maximumSteps).toBeLessThanOrEqual(48);
    expect(timing.maximumAccumulatorBefore)
      .toBeLessThan(1 / 120);
    expect(timing.maximumAccumulatorAfter)
      .toBeLessThan(1 / 120);
    expect(timing.wallToGameRatio)
      .toBeGreaterThan(0.95);
    expect(timing.wallToGameRatio)
      .toBeLessThanOrEqual(1.01);
    expect(Math.abs(timing.playerDisplacement))
      .toBeGreaterThan(10);
  }
);

test(
  "every unique section, boss, and finale theme produces signal and playback progression",
  async ({ page }) => {
    test.setTimeout(240_000);

    for (const [index, id] of
      ALL_UNIQUE_THEMES.entries()) {
      await beginShow(
        page,
        `?qaTheme=${id}`,
        `QaTheme${index}`
      );

      await expect.poll(
        () => page.evaluate(() =>
          window.__IMPRESSARIO_AUDIO_DEBUG__?.()
            .currentSoundtrack
        ),
        { timeout: 20_000 }
      ).toBe(id);

      await expect.poll(
        () => page.evaluate(
          key => {
            const handle =
              window.__IMPRESSARIO_AUDIO_DEBUG__?.()
                .activeHandles.find(
                  candidate =>
                    candidate.logicalKey === key
                );

            return Boolean(
              handle?.isPlaying &&
              handle.duration > 0 &&
              handle.effectiveGain > 0
            );
          },
          id
        ),
        { timeout: 10_000 }
      ).toBe(true);

      const initialPosition =
        await page.evaluate(
          key =>
            window.__IMPRESSARIO_AUDIO_DEBUG__?.()
              .activeHandles.find(
                candidate =>
                  candidate.logicalKey === key
              )?.playbackPosition ?? 0,
          id
        );

      await expect.poll(
        () => page.evaluate(
          key =>
            window.__IMPRESSARIO_AUDIO_DEBUG__?.()
              .activeHandles.find(
                candidate =>
                  candidate.logicalKey === key
              )?.playbackPosition ?? 0,
          id
        )
      ).toBeGreaterThan(
        initialPosition + 0.05
      );

      await expect.poll(
        () => page.evaluate(() =>
          window.__IMPRESSARIO_AUDIO_DEBUG__?.()
            .analyser.observedPeak ?? 0
        )
      ).toBeGreaterThan(0.00001);
    }
  }
);

test(
  "all eleven section assignments, three boss parts, and finale transition without duplicate music",
  async ({ page }) => {
    test.setTimeout(90_000);
    await beginShow(
      page,
      "?qaThemeSequence=1",
      "QaThemeMatrix"
    );

    const expectedRequests = new Map<string, number>();

    for (const [, id] of SECTION_THEME_MATRIX) {
      expectedRequests.set(
        id,
        (expectedRequests.get(id) ?? 0) + 1
      );
    }

    for (const id of [
      "music_11_conductor_phase_2",
      "music_12_conductor_phase_3",
      "music_13_finale"
    ]) {
      expectedRequests.set(id, 1);
    }

    await expect.poll(
      () => page.evaluate(() =>
        window.__IMPRESSARIO_AUDIO_DEBUG__?.()
          .currentSoundtrack
      ),
      { timeout: 30_000 }
    ).toBe("music_13_finale");

    const evidence = await snapshot(page);

    for (const [id, count] of expectedRequests) {
      expect(
        evidence.soundtrackRequests[id] ?? 0,
        `${id} request count`
      ).toBeGreaterThanOrEqual(count);
      expect(
        evidence.playbackHistory.started[id] ?? 0,
        `${id} playback start`
      ).toBeGreaterThan(0);
    }

    for (const id of BOSS_THEMES) {
      expect(evidence.playbackHistory.started[id] ?? 0)
        .toBe(1);
    }

    expect(evidence.playbackHistory.started.music_13_finale)
      .toBe(1);
    expect(evidence.currentBossThemePart).toBeNull();
    expect(evidence.analyser.observedPeak)
      .toBeGreaterThan(0.00001);
    expect(evidence.contextState).toBe("running");
    expect(evidence.preparedContextInUse).toBe(true);
    expect(evidence.finalOutput.contextMatchesDestination)
      .toBe(true);
    expect(evidence.finalOutput.effectiveGain)
      .toBeGreaterThan(0);
    expect(evidence.finalOutput.analyserInFinalOutputPath)
      .toBe(true);
    expect(evidence.busStates.music.muted).toBe(false);
    expect(evidence.busStates.music.effectiveGain)
      .toBeGreaterThan(0);
    expect(evidence.duplicateInstanceCounts.music_13_finale ?? 0)
      .toBe(1);
    expect(
      evidence.activeHandles.filter(handle =>
        handle.bus === "music"
      )
    ).toHaveLength(1);
  }
);
