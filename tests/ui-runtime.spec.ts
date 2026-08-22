import {
  expect,
  test,
  type Locator,
  type Page
} from "@playwright/test";

const LOCAL_MESSAGE =
  "Leaderboard is not available in local development.";

const SCREENSHOT_DIRECTORY =
  "/home/user/webapp/node_modules/.cache/ui-runtime";

const RENDERING_SCREENSHOT_DIRECTORY =
  "/home/user/webapp/node_modules/.cache/rendering-regression";

interface RuntimeMetrics {
  readonly activeIntervals: number;
  readonly activeTimeouts: number;
  readonly canvasCount: number;
  readonly canvasHeight: number;
  readonly canvasWidth: number;
  readonly devicePixelRatio: number;
  readonly listenerBalance: number;
  readonly renderer: "CANVAS" | "WEBGL";
}

interface CanvasSample {
  readonly pixels: number[];
  readonly nonBlank: boolean;
}

interface MovementQaSnapshot {
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly velocityX: number;
    readonly velocityY: number;
    readonly controllable: boolean;
  };
  readonly currentSectionId: string | null;
  readonly cameraSectionId: string | null;
  readonly movementCameraRestricted: boolean;
  readonly checkpoint: {
    readonly checkpointName: string;
  };
  readonly soundtrack: {
    readonly currentSoundtrack: string | null;
    readonly activeCrossfades: number;
  };
  readonly audio: {
    readonly loadingOwners: number;
    readonly lastLoadError: string | null;
  };
  readonly runtimeErrors: readonly string[];
}

interface MovementQaHarness {
  setPlayerLocation(x: number, y: number): void;
  resumePlayerControl(): void;
  snapshot(): MovementQaSnapshot;
}

declare global {
  interface Window {
    __IMPRESSARIO_BOUNDARY_QA__?: MovementQaHarness;
  }
}

async function sampleCanvas(
  page: Page,
  canvas: Locator
): Promise<CanvasSample> {
  const box = await canvas.boundingBox();

  if (!box) {
    return {
      pixels: [],
      nonBlank: false
    };
  }

  const png = await page.screenshot({
    type: "png",
    clip: box
  });

  return canvas.evaluate(
    async (
      _element: HTMLCanvasElement,
      pngBase64: string
    ) => {
      const response = await fetch(
        `data:image/png;base64,${pngBase64}`
      );
      const bitmap = await createImageBitmap(
        await response.blob()
      );
      const sample =
        document.createElement("canvas");

      sample.width = 64;
      sample.height = 36;

      const context = sample.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      );

      if (!context) {
        bitmap.close();

        return {
          pixels: [],
          nonBlank: false
        };
      }

      context.drawImage(
        bitmap,
        0,
        0,
        sample.width,
        sample.height
      );
      bitmap.close();

      const pixels = Array.from(
        context.getImageData(
          0,
          0,
          sample.width,
          sample.height
        ).data
      );

      let minimumLuminance = 255;
      let maximumLuminance = 0;
      let opaquePixels = 0;

      for (
        let index = 0;
        index < pixels.length;
        index += 4
      ) {
        const alpha = pixels[index + 3];

        if (alpha < 16) {
          continue;
        }

        opaquePixels += 1;

        const luminance =
          pixels[index] * 0.2126 +
          pixels[index + 1] * 0.7152 +
          pixels[index + 2] * 0.0722;

        minimumLuminance = Math.min(
          minimumLuminance,
          luminance
        );
        maximumLuminance = Math.max(
          maximumLuminance,
          luminance
        );
      }

      return {
        pixels,
        nonBlank:
          opaquePixels > 1800 &&
          maximumLuminance - minimumLuminance > 35
      };
    },
    png.toString("base64")
  );
}

async function runtimeMetrics(
  page: Page
): Promise<RuntimeMetrics> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      "canvas"
    );
    const state = (
      window as Window & {
        __renderingRegressionMetrics?: {
          activeIntervals: Set<number>;
          activeTimeouts: Set<number>;
          listenerAdds: number;
          listenerRemoves: number;
        };
      }
    ).__renderingRegressionMetrics;
    const gl =
      canvas?.getContext("webgl2") ??
      canvas?.getContext("webgl");

    return {
      activeIntervals:
        state?.activeIntervals.size ?? -1,
      activeTimeouts:
        state?.activeTimeouts.size ?? -1,
      canvasCount:
        document.querySelectorAll("canvas").length,
      canvasHeight: canvas?.height ?? 0,
      canvasWidth: canvas?.width ?? 0,
      devicePixelRatio: window.devicePixelRatio,
      listenerBalance:
        (state?.listenerAdds ?? 0) -
        (state?.listenerRemoves ?? 0),
      renderer: gl ? "WEBGL" : "CANVAS"
    };
  });
}

function changedPixelRatio(
  first: readonly number[],
  second: readonly number[]
): number {
  if (
    first.length === 0 ||
    first.length !== second.length
  ) {
    return 0;
  }

  let changed = 0;
  let pixelCount = 0;

  for (
    let index = 0;
    index < first.length;
    index += 4
  ) {
    pixelCount += 1;

    const difference =
      Math.abs(first[index] - second[index]) +
      Math.abs(first[index + 1] - second[index + 1]) +
      Math.abs(first[index + 2] - second[index + 2]);

    if (difference > 36) {
      changed += 1;
    }
  }

  return changed / pixelCount;
}

test.use({
  viewport: {
    width: 1280,
    height: 720
  }
});

async function beginMovementShow(
  page: Page
): Promise<Locator> {
  await page.goto("/");
  const overlay = page.locator(
    ".leaderboard-overlay"
  );
  await overlay.locator("input").first().fill(
    "Movement QA"
  );
  await overlay.getByRole("button", {
    name: /BEGIN THE SHOW/i
  }).click();

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({
    timeout: 20_000
  });
  await expect.poll(() => page.evaluate(() =>
    typeof window.__IMPRESSARIO_BOUNDARY_QA__
  )).toBe("object");
  await canvas.click();
  return canvas;
}

async function placePlayer(
  page: Page,
  x: number,
  y: number,
  resume = true
): Promise<void> {
  await page.evaluate(([nextX, nextY]) => {
    window.__IMPRESSARIO_BOUNDARY_QA__
      ?.setPlayerLocation(nextX, nextY);
  }, [x, y]);
  await page.waitForTimeout(120);

  if (resume) {
    await page.evaluate(() => {
      window.__IMPRESSARIO_BOUNDARY_QA__
        ?.resumePlayerControl();
    });
    await page.waitForTimeout(80);
  }
}

async function movementSnapshot(
  page: Page
): Promise<MovementQaSnapshot> {
  const snapshot = await page.evaluate(() =>
    window.__IMPRESSARIO_BOUNDARY_QA__
      ?.snapshot()
  );
  expect(snapshot).toBeDefined();
  return snapshot!;
}

test(
  "local start stays request-free and opening tutorial remains spatially separated",
  async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequiredResources: string[] = [];
    const leaderboardRequests: string[] = [];
    const submissionRequests: string[] = [];

    await page.addInitScript(() => {
      const metrics = {
        activeIntervals: new Set<number>(),
        activeTimeouts: new Set<number>(),
        listenerAdds: 0,
        listenerRemoves: 0
      };

      Object.defineProperty(
        window,
        "__renderingRegressionMetrics",
        { value: metrics }
      );

      const originalAdd =
        EventTarget.prototype.addEventListener;
      const originalRemove =
        EventTarget.prototype.removeEventListener;

      EventTarget.prototype.addEventListener =
        function (...args) {
          metrics.listenerAdds += 1;
          return originalAdd.apply(this, args);
        };
      EventTarget.prototype.removeEventListener =
        function (...args) {
          metrics.listenerRemoves += 1;
          return originalRemove.apply(this, args);
        };

      const originalSetTimeout =
        window.setTimeout.bind(window);
      const originalClearTimeout =
        window.clearTimeout.bind(window);
      const originalSetInterval =
        window.setInterval.bind(window);
      const originalClearInterval =
        window.clearInterval.bind(window);

      window.setTimeout = ((callback, delay, ...args) => {
        let id = 0;
        const wrapped = (...callbackArgs: unknown[]) => {
          metrics.activeTimeouts.delete(id);
          if (typeof callback === "function") {
            callback(...callbackArgs);
          }
        };
        id = originalSetTimeout(
          wrapped,
          delay,
          ...args
        );
        metrics.activeTimeouts.add(id);
        return id;
      }) as typeof window.setTimeout;
      window.clearTimeout = (id => {
        metrics.activeTimeouts.delete(
          Number(id)
        );
        originalClearTimeout(id);
      }) as typeof window.clearTimeout;
      window.setInterval = ((callback, delay, ...args) => {
        const id = originalSetInterval(
          callback,
          delay,
          ...args
        );
        metrics.activeIntervals.add(id);
        return id;
      }) as typeof window.setInterval;
      window.clearInterval = (id => {
        metrics.activeIntervals.delete(
          Number(id)
        );
        originalClearInterval(id);
      }) as typeof window.clearInterval;
    });

    page.on("pageerror", error => {
      pageErrors.push(error.message);
    });

    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("request", request => {
      const url = new URL(request.url());

      if (url.pathname.startsWith("/api/")) {
        leaderboardRequests.push(
          `${request.method()} ${url.pathname}`
        );
      }

      if (
        request.method() === "POST" &&
        /^\/api\/runs(?:\/|$)/.test(url.pathname)
      ) {
        submissionRequests.push(url.pathname);
      }
    });

    page.on("requestfailed", request => {
      const url = new URL(request.url());

      if (
        url.pathname.startsWith("/assets/") ||
        url.pathname === "/"
      ) {
        failedRequiredResources.push(
          `${url.pathname}: ${request.failure()?.errorText ?? "unknown"}`
        );
      }
    });

    await page.goto("/");

    const overlay = page.locator(
      ".leaderboard-overlay"
    );

    await expect(overlay).toBeVisible();
    await expect(
      overlay.getByText("PLAYER NAME", {
        exact: true
      })
    ).toBeVisible();
    await expect(
      overlay.getByText(
        "Enter your player name and begin the show.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      overlay.getByText("STAGE NAME", {
        exact: true
      })
    ).toHaveCount(0);

    await page.screenshot({
      path: `${SCREENSHOT_DIRECTORY}/impressario-ui-start-overlay-v2.png`
    });

    const nameInput = overlay.locator(
      "input.leaderboard-name"
    );
    const beginButton = overlay.getByRole(
      "button",
      { name: "BEGIN THE SHOW" }
    );
    const viewButton = overlay.getByRole(
      "button",
      { name: "VIEW LEADERBOARD" }
    );

    await expect(beginButton).toBeDisabled();
    await nameInput.fill("LocalUiRepair");
    await expect(beginButton).toBeEnabled();

    await viewButton.click();
    await expect(
      overlay.getByText(LOCAL_MESSAGE, {
        exact: true
      })
    ).toBeVisible();
    await expect(viewButton).toBeEnabled();
    expect(leaderboardRequests).toEqual([]);

    await viewButton.click();
    await expect(
      overlay.getByText(LOCAL_MESSAGE, {
        exact: true
      })
    ).toHaveCount(1);
    expect(leaderboardRequests).toEqual([]);

    await page.screenshot({
      path: `${SCREENSHOT_DIRECTORY}/impressario-ui-local-leaderboard-v2.png`
    });

    await beginButton.click();

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({
      timeout: 20_000
    });
    await expect(
      page.locator("canvas")
    ).toHaveCount(1);
    await expect(
      page.locator(".leaderboard-overlay")
    ).toHaveCount(0);

    await expect.poll(
      async () =>
        (await sampleCanvas(page, canvas)).nonBlank,
      {
        message:
          "opening gameplay canvas never rendered a nonblank Phaser frame",
        timeout: 20_000
      }
    ).toBe(true);

    const openingSample =
      await sampleCanvas(page, canvas);

    expect(openingSample.nonBlank).toBe(true);
    expect(leaderboardRequests).toEqual([]);
    expect(submissionRequests).toEqual([]);

    await page.screenshot({
      path: `${SCREENSHOT_DIRECTORY}/impressario-ui-movement-start-v2.png`
    });
    await page.screenshot({
      path: `${RENDERING_SCREENSHOT_DIRECTORY}/movement-start-grid-fixed.png`
    });

    const openingRuntime =
      await runtimeMetrics(page);

    expect(openingRuntime).toMatchObject({
      activeIntervals: 0,
      activeTimeouts: 0,
      canvasCount: 1,
      canvasHeight: 360,
      canvasWidth: 640,
      devicePixelRatio: 1,
      renderer: "WEBGL"
    });

    await page.evaluate(() => {
      if (
        document.activeElement instanceof
          HTMLElement
      ) {
        document.activeElement.blur();
      }
    });
    await canvas.click();
    await page.keyboard.down("d");
    await page.waitForTimeout(5000);
    await page.keyboard.up("d");
    await page.waitForTimeout(300);

    await expect(
      page.locator("canvas")
    ).toHaveCount(1);
    await expect(
      page.locator(".leaderboard-overlay")
    ).toHaveCount(0);

    const progressedSample =
      await sampleCanvas(page, canvas);

    expect(progressedSample.nonBlank).toBe(true);
    expect(
      changedPixelRatio(
        openingSample.pixels,
        progressedSample.pixels
      )
    ).toBeGreaterThan(0.003);

    await page.screenshot({
      path: `${SCREENSHOT_DIRECTORY}/impressario-ui-movement-right-v2.png`
    });
    await page.screenshot({
      path: `${RENDERING_SCREENSHOT_DIRECTORY}/movement-after-input-grid-fixed.png`
    });

    const progressedRuntime =
      await runtimeMetrics(page);

    expect(progressedRuntime).toEqual(
      openingRuntime
    );
    console.log(
      "RENDERING_RUNTIME_METRICS=" +
        JSON.stringify(progressedRuntime)
    );

    expect(leaderboardRequests).toEqual([]);
    expect(submissionRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequiredResources).toEqual([]);
  }
);

test(
  "MovementRehearsal lessons render without runtime or resource errors",
  async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", error => {
      pageErrors.push(error.message);
    });
    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await beginMovementShow(page);

    const screenshotPositions = [
      ["jump", 684, 296],
      ["double-jump", 924, 280],
      ["drop-through", 1160, 184],
      ["wall-jump", 1936, 340],
      ["dash", 2944, 296],
      ["finale", 4304, 216]
    ] as const;

    for (const [lesson, x, y] of screenshotPositions) {
      await placePlayer(page, x, y, false);
      await expect.poll(async () =>
        (await movementSnapshot(page)).cameraSectionId
      ).toBe("MovementRehearsal");
      await page.screenshot({
        path:
          `${RENDERING_SCREENSHOT_DIRECTORY}/movement-${lesson}-stage-1.png`,
        fullPage: true
      });
    }

    const snapshot = await movementSnapshot(page);
    expect(snapshot.currentSectionId).toBe("MovementRehearsal");
    expect(snapshot.cameraSectionId).toBe("MovementRehearsal");
    expect(snapshot.movementCameraRestricted).toBe(true);
    expect(snapshot.checkpoint.checkpointName).toBe("Movement Rehearsal");
    expect(snapshot.audio.loadingOwners).toBe(0);
    expect(snapshot.audio.lastLoadError).toBeNull();
    expect(snapshot.runtimeErrors).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  }
);
