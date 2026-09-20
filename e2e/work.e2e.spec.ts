import { expect, test } from '@playwright/test';

import { addAccount, mockGithub, openTab } from './github-mock';

test.describe('work queue', () => {
  test('watches a repository, imports own pull requests and keeps a single CURRENT', async ({
    page,
  }) => {
    await mockGithub(page, {
      login: 'mane-work',
      repositories: [{ owner: 'acme', name: 'api' }],
      pullRequests: {
        '501': {
          number: 501,
          title: 'Fix token manager',
          author: 'mane-work',
          headSha: 'a',
          comments: 0,
          reviewComments: 0,
          commits: 2,
        },
        '502': {
          number: 502,
          title: 'Improve retry logic',
          author: 'mane-work',
          headSha: 'b',
          comments: 0,
          reviewComments: 0,
          commits: 1,
        },
        '503': {
          number: 503,
          title: 'Someone else',
          author: 'colleague',
          headSha: 'c',
          comments: 0,
          reviewComments: 0,
          commits: 1,
        },
      },
      reviews: {},
    });
    await addAccount(page, 'Trabajo');

    await openTab(page, 'Trabajo');
    await page.getByText('Repositorios de Trabajo').click();
    await page.getByRole('button', { name: 'Cargar repositorios' }).click();
    await page.locator('app-watched-repositories').getByRole('combobox').selectOption('acme/api');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Repositorios seguidos' })).toContainText(
      'acme/api',
    );

    await page.getByRole('button', { name: 'Importar mis PR abiertos' }).click();
    await expect(page.getByRole('status')).toContainText(
      '2 Pull Request(s) nuevo(s) importado(s).',
    );

    const cards = page.getByRole('list', { name: 'Pull Requests en trabajo' }).getByRole('article');
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: '#503' })).toHaveCount(0);

    const first = cards.filter({ hasText: '#501' });
    const second = cards.filter({ hasText: '#502' });
    await first.getByLabel('Estado').selectOption('CURRENT');
    await expect(first.getByLabel('Estado')).toHaveValue('CURRENT');

    await second.getByLabel('Estado').selectOption('CURRENT');
    await expect(second.getByLabel('Estado')).toHaveValue('CURRENT');
    await expect(first.getByLabel('Estado')).toHaveValue('PAUSED');

    await page.reload();
    await expect(
      page.getByRole('list', { name: 'Pull Requests en trabajo' }).getByRole('article'),
    ).toHaveCount(2);
  });

  test('filters the queue by text and attention', async ({ page }) => {
    await mockGithub(page, {
      login: 'mane-work',
      repositories: [{ owner: 'acme', name: 'api' }],
      pullRequests: {
        '501': {
          number: 501,
          title: 'Fix token manager',
          author: 'mane-work',
          headSha: 'a',
          comments: 0,
          reviewComments: 0,
          commits: 2,
        },
        '502': {
          number: 502,
          title: 'Improve retry logic',
          author: 'mane-work',
          headSha: 'b',
          comments: 0,
          reviewComments: 0,
          commits: 1,
        },
      },
      reviews: {},
    });
    await addAccount(page, 'Trabajo');
    await openTab(page, 'Trabajo');
    await page.getByText('Repositorios de Trabajo').click();
    await page.getByRole('button', { name: 'Cargar repositorios' }).click();
    await page.locator('app-watched-repositories').getByRole('combobox').selectOption('acme/api');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByRole('button', { name: 'Importar mis PR abiertos' }).click();
    const cards = page.getByRole('list', { name: 'Pull Requests en trabajo' }).getByRole('article');
    await expect(cards).toHaveCount(2);

    await page.getByLabel('Buscar').fill('retry');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Improve retry logic');
    await expect(page.getByText('1 de 2')).toBeVisible();

    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(cards).toHaveCount(2);

    await page.getByLabel('Solo con atención').check();
    await expect(cards).toHaveCount(0);
    await expect(page.getByText('Ningún Pull Request coincide con los filtros.')).toBeVisible();
  });
});
