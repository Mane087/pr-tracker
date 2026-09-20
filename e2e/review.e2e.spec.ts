import { expect, test } from '@playwright/test';

import { addAccount, mockGithub, openTab } from './github-mock';

test.describe('review queue', () => {
  test('adds a pull request, marks it as reviewed and detects new commits on refresh', async ({
    page,
  }) => {
    const github = await mockGithub(page, {
      login: 'mane-work',
      repositories: [],
      pullRequests: {
        '561': {
          number: 561,
          title: 'Detect expired certificate',
          author: 'colleague',
          headSha: 'sha-1',
          comments: 1,
          reviewComments: 0,
          commits: 4,
          labels: [{ name: 'bug', color: 'd73a4a' }],
        },
      },
      reviews: { '561': 1 },
    });
    await addAccount(page, 'Trabajo');

    await openTab(page, 'Revisión');
    await page.getByText('Agregar PR').click();
    await page.getByLabel('Repositorio').fill('acme/api');
    await page.getByLabel('PR', { exact: true }).fill('561');
    await page.getByRole('button', { name: 'Agregar' }).click();

    const card = page.getByRole('list', { name: 'Pull Requests en revisión' }).getByRole('article');
    await expect(card).toContainText('acme/api · #561');
    await expect(card).toContainText('Detect expired certificate');
    await expect(card).toContainText('bug');
    await expect(card.getByLabel('Estado')).toHaveValue('PENDING');

    await card.getByRole('button', { name: 'Marcar como revisado' }).click();
    await expect(card.getByLabel('Estado')).toHaveValue('REVIEWED');
    await expect(card.getByRole('button', { name: 'Marcar como revisado' })).toHaveCount(0);

    github.pullRequests['561'] = {
      ...github.pullRequests['561'],
      headSha: 'sha-2',
      commits: 5,
      comments: 3,
    };
    await page.getByRole('button', { name: 'Actualizar Pull Requests' }).click();

    await expect(card.getByLabel('Estado')).toHaveValue('NEEDS_REVIEW');
    await expect(card.getByLabel('Requiere atención')).toBeVisible();
    await expect(card).toContainText('1 commit nuevo · 2 comentarios nuevos');
    await expect(page.getByText('Última actualización:')).toContainText(
      '1 sincronizados · 1 con atención',
    );

    await card.getByRole('button', { name: 'Visto' }).click();
    await expect(card.getByLabel('Requiere atención')).toHaveCount(0);
    await expect(card.getByLabel('Estado')).toHaveValue('NEEDS_REVIEW');
  });

  test('sends If-None-Match on the next refresh and keeps the state on 304', async ({ page }) => {
    const github = await mockGithub(page, {
      login: 'mane-work',
      repositories: [],
      pullRequests: {
        '9': {
          number: 9,
          title: 'Quiet PR',
          author: 'colleague',
          headSha: 'sha-1',
          comments: 1,
          reviewComments: 0,
          commits: 1,
        },
      },
      reviews: { '9': 1 },
      requests: [],
    });
    await addAccount(page, 'Trabajo');

    await openTab(page, 'Revisión');
    await page.getByText('Agregar PR').click();
    await page.getByLabel('Repositorio').fill('acme/api');
    await page.getByLabel('PR', { exact: true }).fill('9');
    await page.getByRole('button', { name: 'Agregar' }).click();
    const card = page.getByRole('list', { name: 'Pull Requests en revisión' }).getByRole('article');
    await card.getByRole('button', { name: 'Marcar como revisado' }).click();
    await expect(card.getByLabel('Estado')).toHaveValue('REVIEWED');
    github.requests!.length = 0;

    await page.getByRole('button', { name: 'Actualizar Pull Requests' }).click();
    await expect(page.getByText('Última actualización:')).toContainText('1 sincronizados');
    expect(github.requests).toEqual([
      'GET /repos/acme/api/pulls/9 304',
      'GET /repos/acme/api/pulls/9/reviews 304',
    ]);
    await expect(card.getByLabel('Estado')).toHaveValue('REVIEWED');
    await expect(card.getByLabel('Requiere atención')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('archives a merged pull request on refresh', async ({ page }) => {
    const github = await mockGithub(page, {
      login: 'mane-work',
      repositories: [],
      pullRequests: {
        '7': {
          number: 7,
          title: 'Small fix',
          author: 'colleague',
          headSha: 'sha-1',
          comments: 0,
          reviewComments: 0,
          commits: 1,
        },
      },
      reviews: {},
    });
    await addAccount(page, 'Trabajo');

    await openTab(page, 'Revisión');
    await page.getByText('Agregar PR').click();
    await page.getByLabel('Repositorio').fill('acme/api');
    await page.getByLabel('PR', { exact: true }).fill('7');
    await page.getByRole('button', { name: 'Agregar' }).click();
    const list = page.getByRole('list', { name: 'Pull Requests en revisión' });
    await expect(list.getByRole('article')).toHaveCount(1);

    github.pullRequests['7'] = { ...github.pullRequests['7'], merged: true, state: 'closed' };
    await page.getByRole('button', { name: 'Actualizar Pull Requests' }).click();

    await expect(list.getByRole('article')).toHaveCount(0);
    await expect(page.getByText('Última actualización:')).toContainText('1 archivados');
  });
});
