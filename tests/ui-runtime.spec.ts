import {
  expect,
  test
} from "@playwright/test";

const LOCAL_MESSAGE =
  "Leaderboard is not available in local development.";

test.use({
  viewport: {
    width: 1280,
    height: 720
  }
});

test(
  "local start remains playable without leaderboard requests and tutorial signage stays foregrounded",
  async ({ page }) => {
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
      path: "/home/user/webapp/node_modules/.cache/ui-runtime/impressario-ui-start-overlay.png"
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
      path: "/home/user/webapp/node_modules/.cache/ui-runtime/impressario-ui-local-leaderboard.png"
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

    await page.waitForTimeout(800);
    expect(leaderboardRequests).toEqual([]);
    expect(submissionRequests).toEqual([]);

    await page.screenshot({
      path: "/home/user/webapp/node_modules/.cache/ui-runtime/impressario-ui-movement-start.png"
    });

    await canvas.click();
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(250);

    await expect(
      page.locator("canvas")
    ).toHaveCount(1);
    await expect(
      page.locator(".leaderboard-overlay")
    ).toHaveCount(0);

    await page.screenshot({
      path: "/home/user/webapp/node_modules/.cache/ui-runtime/impressario-ui-movement-right.png"
    });

    expect(leaderboardRequests).toEqual([]);
    expect(submissionRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequiredResources).toEqual([]);
  }
);
