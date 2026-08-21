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

interface CanvasSample {
  readonly pixels: number[];
  readonly nonBlank: boolean;
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

test(
  "local start stays request-free and opening tutorial remains spatially separated",
  async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequiredResources: string[] = [];
    const leaderboardRequests: string[] = [];
    const submissionRequests: string[] = [];

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

    expect(leaderboardRequests).toEqual([]);
    expect(submissionRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequiredResources).toEqual([]);
  }
);
