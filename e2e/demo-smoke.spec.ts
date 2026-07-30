import { test, expect } from '@playwright/test';

// Smoke test for the synthetic public demo core loop. Uses only the
// backend-free /demo-app route with deterministic sample data, so it needs no
// Supabase credentials.
test.describe('synthetic demo', () => {
  test('renders plan item, timeline axis, and recap evidence', async ({ page }) => {
    await page.goto('/demo-app');

    // Public demo shell is present.
    await expect(page.getByText('Public demo')).toBeVisible();

    // A deterministic synthetic plan item is shown.
    await expect(page.getByText('Draft project notes').first()).toBeVisible();

    // The timeline time axis has rendered.
    await expect(page.getByText('12:00').first()).toBeVisible();

    // The daily recap surfaces tracked focus evidence.
    await expect(page.getByText('focused').first()).toBeVisible();
  });

  test('exposes the add-task composer', async ({ page }) => {
    await page.goto('/demo-app');
    await expect(page.getByPlaceholder('Add a task...')).toBeVisible();
  });
});
