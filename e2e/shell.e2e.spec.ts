import { expect, test } from '@playwright/test';

test.describe('application shell', () => {
  test('shows the title, the tabs and the empty state', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PR Tracker');
    await expect(page.getByRole('navigation', { name: 'Secciones' }).getByRole('link')).toHaveText([
      'Trabajo',
      'Revisión',
    ]);
    await expect(page.getByText('Configura una cuenta de GitHub en')).toBeVisible();
    await expect(page.locator('header select')).toHaveCount(0);
  });

  test('switches between light and dark theme and remembers it', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
    await expect(html).toHaveClass(/dark/);

    await page.reload();
    await expect(html).toHaveClass(/dark/);
  });

  test('navigates to the review tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Revisión' }).click();

    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Revisión');
  });
});
