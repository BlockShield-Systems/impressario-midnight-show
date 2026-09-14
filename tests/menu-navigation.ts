import { expect, type Page } from "@playwright/test";

/** Exercise the same visible entry point as players, never a QA bypass. */
export async function openStartScreen(page: Page): Promise<void> {
  const menu = page.getByRole("region", { name: "Main menu" });
  await expect(menu).toBeVisible();
  await expect(page.locator(".leaderboard-overlay")).toHaveCount(0);
  await menu.getByRole("button", { name: "Start Game", exact: true }).click();
  await expect(page.locator(".leaderboard-overlay")).toBeVisible();
}
