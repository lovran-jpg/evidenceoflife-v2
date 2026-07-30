import { test, expect } from '@playwright/test';

// Smoke test for the synthetic public demo core loop. Uses only the
// backend-free /demo-app route with deterministic sample data, so it needs no
// real Supabase project (dummy VITE_* vars are injected in playwright.config).
test.describe('synthetic demo', () => {
  test('renders plan item, timeline axis, and recap evidence', async ({ page }) => {
    await page.goto('/demo-app');

    await expect(page.getByText('Public demo')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Draft project notes').first()).toBeVisible();
    await expect(page.getByText('12:00').first()).toBeVisible();
    await expect(page.getByText('focused').first()).toBeVisible();
  });

  test('exposes the add-task composer', async ({ page }) => {
    await page.goto('/demo-app');
    await expect(page.getByText('Public demo')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByPlaceholder(/Add a task/i).or(page.getByPlaceholder(/添加任务/)),
    ).toBeVisible();
  });
});
