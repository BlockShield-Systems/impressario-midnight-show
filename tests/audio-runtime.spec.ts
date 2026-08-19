import {
  expect,
  test
} from "@playwright/test";

interface AudioDebugSnapshot {
  readonly activeSounds: number;
  readonly activeLoops: number;
  readonly loadingOwners: number;
  readonly cachedOwners: number;
  readonly totalOwners: number;
  readonly contextState: string;
  readonly lastLoadError: string | null;
}

declare global {
  interface Window {
    __IMPRESSARIO_AUDIO_DEBUG__?:
      () => AudioDebugSnapshot;
  }
}

test(
  "audio runtime unlocks, loads lazily and remains stable",
  async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedAudioRequests:
      string[] = [];

    page.on(
      "pageerror",
      error => {
        pageErrors.push(
          error.message
        );
      }
    );

    page.on(
      "console",
      message => {
        if (
          message.type() === "error"
        ) {
          consoleErrors.push(
            message.text()
          );
        }
      }
    );

    page.on(
      "requestfailed",
      request => {
        if (
          /\/assets\/audio\/.*\.(?:ogg|mp3)(?:\?|$)/i
            .test(request.url())
        ) {
          failedAudioRequests.push(
            `${request.url()}: ${
              request.failure()
                ?.errorText ??
              "unknown"
            }`
          );
        }
      }
    );

    page.on(
      "response",
      response => {
        if (
          /\/assets\/audio\/.*\.(?:ogg|mp3)(?:\?|$)/i
            .test(response.url()) &&
          response.status() >= 400
        ) {
          failedAudioRequests.push(
            `${response.status()} ${
              response.url()
            }`
          );
        }
      }
    );

    await page.goto("/");

    const overlay =
      page.locator(
        ".leaderboard-overlay"
      );

    await expect(overlay)
      .toBeVisible();

    const nameInput =
      overlay.locator("input")
        .first();

    await nameInput.fill(
      "AudioSmoke"
    );

    const beginButton =
      overlay.getByRole(
        "button",
        {
          name: /BEGIN THE SHOW/i
        }
      );

    await expect(beginButton)
      .toBeEnabled({
        timeout: 15_000
      });

    /*
     * Der Klick ist der relevante Browser-User-Gesture,
     * mit dem WebAudio entsperrt werden muss.
     */
    await beginButton.click();

    const canvas =
      page.locator("canvas");

    await expect(canvas)
      .toBeVisible({
        timeout: 20_000
      });

    await canvas.click();

    await expect.poll(
      async () =>
        page.evaluate(
          () =>
            typeof window
              .__IMPRESSARIO_AUDIO_DEBUG__
              === "function"
        )
    ).toBe(true);

    await expect.poll(
      async () =>
        page.evaluate(
          () =>
            window
              .__IMPRESSARIO_AUDIO_DEBUG__
              ?.().loadingOwners ??
            -1
        ),
      {
        timeout: 20_000
      }
    ).toBe(0);

    const initial =
      await page.evaluate(
        () =>
          window
            .__IMPRESSARIO_AUDIO_DEBUG__
            ?.()
      );

    expect(initial)
      .toBeDefined();

    expect(
      initial!.lastLoadError
    ).toBeNull();

    expect(
      initial!.cachedOwners
    ).toBeGreaterThan(0);

    /*
     * Beweist, dass nicht mehr alle physischen
     * Owners im Boot-Preload geladen werden.
     */
    expect(
      initial!.cachedOwners
    ).toBeLessThan(
      initial!.totalOwners
    );

    expect(
      initial!.contextState
    ).toBe("running");

    /*
     * Spieleraktionen erzeugen Player-, Combat-
     * und potentiell Step-SFX.
     */
    await page.keyboard.down(
      "ArrowRight"
    );

    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    await page.keyboard.press("Shift");
    await page.waitForTimeout(220);
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(650);

    await page.keyboard.up(
      "ArrowRight"
    );

    await page.waitForTimeout(800);

    /*
     * HUD ein-/ausschalten prüft zusätzlich,
     * dass dessen Event-Handler keine Fehler wirft.
     */
    await page.keyboard.press("F8");
    await page.waitForTimeout(250);
    await page.keyboard.press("F8");

    const finalSnapshot =
      await page.evaluate(
        () =>
          window
            .__IMPRESSARIO_AUDIO_DEBUG__
            ?.()
      );

    expect(finalSnapshot)
      .toBeDefined();

    expect(
      finalSnapshot!.lastLoadError
    ).toBeNull();

    expect(
      finalSnapshot!.loadingOwners
    ).toBe(0);

    /*
     * In Zone 0 dürfen regulär nur Music und
     * Ambience dauerhaft loopen.
     */
    expect(
      finalSnapshot!.activeLoops
    ).toBeLessThanOrEqual(2);

    const audioResources =
      await page.evaluate(
        () =>
          performance
            .getEntriesByType(
              "resource"
            )
            .map(entry => entry.name)
            .filter(name =>
              /\/assets\/audio\/.*\.(?:ogg|mp3)(?:\?|$)/i
                .test(name)
            )
      );

    expect(
      audioResources.length
    ).toBeGreaterThan(0);

    expect(
      failedAudioRequests,
      failedAudioRequests.join("\n")
    ).toEqual([]);

    expect(
      pageErrors,
      pageErrors.join("\n")
    ).toEqual([]);

    /*
     * Erwartbare Browser-/Netzwerkdiagnosen nicht
     * pauschal ignorieren: echte console.error-
     * Meldungen müssen den Test stoppen.
     */
    expect(
      consoleErrors,
      consoleErrors.join("\n")
    ).toEqual([]);
  }
);
