import {test, expect} from '@playwright/test';
import {ACCOUNTS, AUTH, PARTICIPANT_ROUTES, VIEWPORTS, expectHealthyPage, internalLinks, signIn, watchErrors} from './helpers';

test.describe('participant portal', () => {
  test.use({storageState: AUTH.participant});

  for (const route of PARTICIPANT_ROUTES) {
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      test(`${route} renders cleanly on ${name}`, async ({page}) => {
        const errors = watchErrors(page);
        await page.setViewportSize(size);
        const res = await page.goto(route);
        expect(res?.status()).toBe(200);
        await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/') + '$'));
        await page.waitForLoadState('networkidle');
        await expectHealthyPage(page);
        expect(errors).toEqual([]);
      });
    }
  }

  test('topbar shows who is signed in', async ({page}) => {
    await page.goto('/dashboard');
    await expect(page.locator('.user-chip')).toContainText('Test Participant 1');
    await expect(page.locator('.user-chip .badge')).toHaveText(['participant']);
    await expect(page.locator('.phase-chip')).toBeVisible();
  });

  test('sidebar shows only participant sections and every link works', async ({page}) => {
    test.setTimeout(180_000);
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation', {name: 'Portal'}).first();
    await expect(nav).toContainText('My submission');
    await expect(nav).not.toContainText('Review queue');
    await expect(nav).not.toContainText('Audit log');
    const links = nav.getByRole('link');
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      const link = nav.getByRole('link').nth(i);
      const href = await link.getAttribute('href');
      await link.click();
      await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, '\\/') + '$'));
      // Event rules is a public page without the portal sidebar.
      if (href !== '/event-rules') await expect(page.locator('nav[aria-label="Portal"] .nav-link.active').first()).toHaveAttribute('href', href!);
      await page.goto('/dashboard');
    }
  });

  test('every link inside the portal resolves', async ({page}) => {
    test.setTimeout(180_000);
    const seen = new Set<string>();
    for (const route of PARTICIPANT_ROUTES) {
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

  test('mobile menu opens, navigates and closes', async ({page}) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/dashboard');
    const button = page.getByRole('button', {name: 'Open menu'});
    await button.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/open/);
    await button.click();
    await drawer.getByRole('link', {name: 'Project wall'}).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('#drawer')).not.toHaveClass(/open/);
  });

  test('project wall search works and cards open', async ({page}) => {
    await page.goto('/projects');
    const cards = page.locator('.project-card');
    const total = await cards.count();
    await page.getByPlaceholder(/Search titles/).fill('zzzz-no-such-project');
    await page.getByRole('button', {name: 'Search'}).click();
    await expect(page).toHaveURL(/q=zzzz-no-such-project/);
    await expect(page.locator('.empty')).toBeVisible();
    if (total) {
      await page.goto('/projects');
      const first = page.locator('.project-card h2 a').first();
      const title = await first.innerText();
      await first.click();
      await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
      await expect(page.getByRole('heading', {level: 1})).toHaveText(title);
      await page.getByRole('link', {name: /All projects/}).click();
      await expect(page).toHaveURL(/\/projects$/);
    }
  });

  test('unknown project id is a 404, not a crash', async ({page}) => {
    // Pages stream behind a loading screen, so Next answers 200 with the not-found page.
    for (const path of ['/projects/00000000-0000-4000-8000-000000000000', '/projects/not-a-uuid']) {
      await page.goto(path);
      await expect(page.getByRole('heading', {name: 'This page wandered off.'}), path).toBeVisible();
    }
  });

  test('submission page matches the event phase', async ({page, request}) => {
    const event = await (await request.get('/api/event')).json();
    await page.goto('/submission');
    if (event.phase === 'submissions') {
      await expect(page.getByLabel('Project title')).toBeVisible();
      await expect(page.getByRole('button', {name: 'Save draft'})).toBeVisible();
    } else if (event.phase === 'setup') {
      await expect(page.getByText('Submissions open when the bash starts.')).toBeVisible();
    } else {
      await expect(page.getByLabel('Project title')).toHaveCount(0);
    }
  });

  test('results stay hidden until published', async ({page, request}) => {
    const event = await (await request.get('/api/event')).json();
    await page.goto('/results');
    if (event.phase !== 'results_published') {
      await expect(page.getByRole('heading', {level: 1})).toHaveText('The leaderboard is hidden.');
      await expect(page.locator('.result-list')).toHaveCount(0);
    }
  });

  test('voting booth state matches eligibility', async ({page, request}) => {
    const status = await (await request.get('/api/voting/eligibility')).json();
    await page.goto('/voting');
    if (status.eligible) await expect(page.locator('.cup-tray')).toBeVisible();
    else if (status.has_ballot) await expect(page.getByText('Your ballot is in.')).toBeVisible();
    else await expect(page.locator('.gate')).toBeVisible();
  });

  test('login page sends a signed-in user straight to the dashboard', async ({page}) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test('sign out ends the session everywhere', async ({browser}) => {
  // Uses a separate account: signing out revokes that user's sessions.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, ACCOUNTS.participant2);
  await page.waitForURL('**/dashboard');
  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
