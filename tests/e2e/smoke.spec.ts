import { expect, test } from "@playwright/test";

test("marketing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Notion-style memory/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Workspace/i })).toBeVisible();
});
