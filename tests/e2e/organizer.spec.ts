import {test, expect} from '@playwright/test';
import {AUTH, ORGANIZER_ROUTES, REVIEWER_ROUTES, VIEWPORTS, expectHealthyPage, internalLinks, watchErrors} from './helpers';

// Read-only against the live event: dialogs are opened and cancelled, never confirmed.
test.describe('organizer desk', () => {
  test.use({storageState: AUTH.organizer});

  for (const route of [...ORGANIZER_ROUTES, ...REVIEWER_ROUTES, '/dashboard', '/projects', '/results']) {
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      test(`${route} renders cleanly on ${name}`, async ({page}) => {
        const errors = watchErrors(page);
        await page.setViewportSize(size);
        const res = await page.goto(route);
        expect(res?.status()).toBe(200);
        await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/') + '$'));
        await page.waitForLoadState('networkidle');
        await expectHealthyPage(page);
        expect(errors).toEqual([]);
      });
    }
  }

  test('roles and sidebar sections', async ({page}) => {
    await page.goto('/dashboard');
    await expect(page.locator('.user-chip .badge')).toHaveText(['reviewer', 'organizer'], {ignoreCase: true, useInnerText: true}).catch(async () => {
      expect((await page.locator('.user-chip .badge').allInnerTexts()).sort()).toEqual(['organizer', 'reviewer']);
    });
    const nav = page.getByRole('navigation', {name: 'Portal'}).first();
    for (const label of ['Overview', 'Submissions', 'Reviews', 'Shortlist', 'Voting', 'Results & awards', 'People', 'Review queue']) {
      await expect(nav.getByRole('link', {name: label, exact: true})).toBeVisible();
    }
    await expect(nav).not.toContainText('My submission');
  });

  test('every sidebar link navigates and highlights', async ({page}) => {
    test.setTimeout(240_000);
    await page.goto('/dashboard');
    const hrefs = await page.getByRole('navigation', {name: 'Portal'}).first().getByRole('link').evaluateAll(as => as.map(a => a.getAttribute('href')!));
    for (const href of hrefs) {
      await page.goto('/dashboard');
      await page.getByRole('navigation', {name: 'Portal'}).first().locator(`a[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(href.replace(/\//g, '\\/') + '$'));
      if (href !== '/event-rules') await expect(page.locator('.nav-link.active').first()).toHaveAttribute('href', href);
    }
  });

  test('every link across the organizer desk resolves', async ({page}) => {
    test.setTimeout(240_000);
    const seen = new Set<string>();
    for (const route of [...ORGANIZER_ROUTES, ...REVIEWER_ROUTES]) {
      await page.goto(route);
      for (const link of await internalLinks(page)) {
        const path = link.split('#')[0];
        if (!path || seen.has(path)) continue;
        seen.add(path);
        const res = await page.request.get(path);
        expect(res.status(), `${path} (from ${route})`).toBeLessThan(400);
      }
    }
  });

  test('overview shows stats, phase control and the real schedule', async ({page}) => {
    await page.goto('/admin/overview');
    await expect(page.locator('.stat')).toHaveCount(4);
    await expect(page.getByText('phase_control.exe')).toBeVisible();
    await expect(page.locator('input[name="starts_at"]')).toHaveValue(/2026-10-23T/);
    await expect(page.getByLabel('Event timezone (IANA)')).toHaveValue('Asia/Kolkata');
  });

  test('schedule helper fills a 5 hour plan without saving', async ({page}) => {
    await page.goto('/admin/overview');
    await page.locator('input[name="starts_at"]').fill('2026-10-23T10:00');
    await page.getByRole('button', {name: 'Plan a 5 hour day'}).click();
    const field = (name: string) => page.locator(`input[name="${name}"]`);
    await expect(field('submission_deadline')).toHaveValue('2026-10-23T13:00');
    await expect(field('review_deadline')).toHaveValue('2026-10-23T13:45');
    await expect(field('voting_open_at')).toHaveValue('2026-10-23T13:55');
    await expect(field('voting_close_at')).toHaveValue('2026-10-23T14:40');
    await expect(field('ends_at')).toHaveValue('2026-10-23T15:00');
    await page.reload(); // nothing saved
  });

  test('sensitive actions need a typed confirmation and can be cancelled', async ({page}) => {
    await page.goto('/admin/overview');
    const move = page.getByRole('button', {name: /^Move to/});
    test.skip(await move.count() === 0, 'no single-click phase move in this phase');
    await move.click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', {name: /^Move to/});
    await confirm.click(); // empty confirmation word: the browser blocks the submit
    await expect(dialog).toBeVisible();
    expect(await dialog.locator('input[pattern]').evaluate((e: HTMLInputElement) => e.validity.valid)).toBe(false);
    await dialog.getByRole('button', {name: 'Close'}).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('submissions filters and CSV export', async ({page}) => {
    await page.goto('/admin/submissions');
    for (const filter of ['submitted', 'eligible', 'ineligible', 'draft', 'withdrawn', 'all']) {
      await page.locator('.segmented').getByRole('link', {name: filter, exact: true}).click();
      await expect(page.locator('.segmented a.on')).toHaveText(filter);
    }
    const csv = await page.request.get('/api/admin/submissions?format=csv');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect((await csv.text()).split('\n')[0]).toContain('"title"'.replace(/"/g, '') );
  });

  test('submission rows expand to show details', async ({page}) => {
    await page.goto('/admin/submissions');
    const row = page.locator('details.admin-row').first();
    test.skip(await row.count() === 0, 'no submissions yet');
    await row.locator('summary').click();
    await expect(row.locator('.admin-row-body')).toBeVisible();
  });

  test('reviews, shortlist, voting, results and people show their tools', async ({page}) => {
    await page.goto('/admin/reviews');
    await expect(page.getByText('workload.exe')).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Auto-assign'})).toBeVisible();
    await page.goto('/admin/shortlist');
    await expect(page.getByText('tally.csv')).toBeVisible();
    await page.goto('/admin/voting');
    await expect(page.getByText('ballot_ledger.log')).toBeVisible();
    await page.goto('/admin/results');
    await expect(page.getByRole('heading', {name: 'Creative Award'})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Best GitHub Award'})).toBeVisible();
    await page.goto('/admin/people');
    await expect(page.locator('.people-list').first()).toContainText('Tejas');
    await expect(page.locator('.people-list.roster')).toContainText('Test Participant 1');
  });


  test('organizer APIs answer 200', async ({request}) => {
    for (const path of ['/api/admin/overview', '/api/admin/submissions', '/api/admin/reviews', '/api/reviewer/assignments']) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const overview = await (await request.get('/api/admin/overview')).json();
    expect(overview.stats.participants).toBeGreaterThan(0);
  });

  test('reviewer queue tabs switch', async ({page}) => {
    await page.goto('/reviewer/queue');
    await page.getByRole('tab', {name: /Done/}).click();
    await expect(page).toHaveURL(/view=done/);
    await page.getByRole('tab', {name: /To review/}).click();
    await expect(page).toHaveURL(/\/reviewer\/queue$/);
  });

  test("a reviewer can't open an assignment that isn't theirs", async ({page}) => {
    // Pages stream behind a loading screen, so Next answers 200 with the not-found page.
    await page.goto('/reviewer/projects/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', {name: 'This page wandered off.'})).toBeVisible();
    await expect(page.locator('.review-grid')).toHaveCount(0);
  });
});
