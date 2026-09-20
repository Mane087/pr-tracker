import { expect, test } from '@playwright/test';

import { addAccount, FAKE_TOKEN, mockGithub } from './github-mock';

test.describe('GitHub accounts', () => {
  test('adds an account, keeps only its metadata after a reload and accepts the token again', async ({
    page,
  }) => {
    await mockGithub(page, { login: 'mane-work', repositories: [], pullRequests: {}, reviews: {} });

    await addAccount(page, 'Trabajo');
    await expect(page.getByText('@mane-work')).toBeVisible();
    await expect(page.locator('header select')).toHaveValue(/.+/);

    await page.reload();
    await expect(page.getByRole('status')).toContainText('Falta el token de: Trabajo');
    await expect(page.getByText('Token requerido', { exact: true })).toBeVisible();

    const accountItem = page
      .getByRole('list', { name: 'Cuentas configuradas' })
      .getByRole('listitem');
    await accountItem.getByLabel('Token de acceso').fill('github_pat_FAKE_WRONG');
    await accountItem.getByRole('button', { name: 'Ingresar token' }).click();
    await expect(accountItem.getByRole('alert')).toContainText('El token no es válido o expiró.');
    await expect(accountItem.getByLabel('Token de acceso')).toHaveValue('github_pat_FAKE_WRONG');
    await expect(page.getByText('Token requerido', { exact: true })).toBeVisible();

    await accountItem.getByLabel('Token de acceso').fill(FAKE_TOKEN);
    await accountItem.getByRole('button', { name: 'Ingresar token' }).click();
    await expect(page.getByText('Token en memoria')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('rejects an invalid token without creating the account', async ({ page }) => {
    await mockGithub(page, { login: 'mane-work', repositories: [], pullRequests: {}, reviews: {} });

    await page.goto('/settings');
    await page.getByLabel('Nombre').fill('Trabajo');
    await page.getByLabel('Token de acceso').fill('github_pat_FAKE_BAD');
    await page.getByRole('button', { name: 'Agregar cuenta' }).click();

    await expect(page.getByRole('alert')).toContainText('El token no es válido o expiró.');
    await expect(page.getByText('Todavía no hay cuentas configuradas.')).toBeVisible();
  });

  test('forgets an account together with its data', async ({ page }) => {
    await mockGithub(page, { login: 'mane-work', repositories: [], pullRequests: {}, reviews: {} });
    await addAccount(page, 'Trabajo');
    page.on('dialog', (dialog) => dialog.accept());

    await page.getByRole('button', { name: 'Olvidar cuenta' }).click();

    await expect(page.getByText('Todavía no hay cuentas configuradas.')).toBeVisible();
    await expect(page.locator('header select')).toHaveCount(0);
  });
});
