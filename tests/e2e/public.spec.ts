import {test, expect} from '@playwright/test';
import {PUBLIC_ROUTES, VIEWPORTS, expectHealthyPage, externalLinks, internalLinks, watchErrors} from './helpers';

test.describe('public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      test(`${route} renders cleanly on ${name}`, async ({page}) => {
        const errors = watchErrors(page);
        await page.setViewportSize(size);
        const res = await page.goto(route);
        expect(res?.status()).toBe(200);
        await page.waitForLoadState('networkidle');
        await expectHealthyPage(page);
        // Scroll to the bottom so lazy images and scroll-driven reveals all run.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        await expectHealthyPage(page);
        expect(errors).toEqual([]);
      });
    }
  }

  test('every internal link on public pages resolves', async ({page, request}) => {
    test.setTimeout(180_000);
    const seen = new Set<string>();
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      for (const link of await internalLinks(page)) {
        const [path, hash] = link.split('#');
        const target = path || route;
        if (hash) {
          // In-page anchors must point at a real element.
          await page.goto(target);
          expect(await page.locator('#' + hash).count(), `anchor #${hash} on ${target}`).toBeGreaterThan(0);
        }
        if (seen.has(target)) continue;
        seen.add(target);
        const res = await request.get(target);
        expect(res.status(), `${target} (linked from ${route})`).toBeLessThan(400);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test('external links open safely in a new tab', async ({page}) => {
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      for (const link of await externalLinks(page)) {
        expect(link.target, link.href).toBe('_blank');
        expect(link.rel, link.href).toContain('noreferrer');
      }
    }
  });

  test('header navigation reaches each section', async ({page}) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', {name: 'Main navigation'});
    await nav.getByRole('link', {name: 'rules'}).click();
    await expect(page).toHaveURL(/\/event-rules$/);
    await expect(page.getByRole('heading', {level: 1})).toContainText('How it works');
    await page.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'home'}).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: /enter the portal/}).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('landing shows the real event details', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('.hero-meta')).toContainText('23 Oct');
    await expect(page.locator('.event-note')).toContainText('23 Oct');
    await expect(page.locator('.venue-art h2')).toContainText('Chandigarh University');
    await expect(page.locator('.site-footer')).toContainText('Chandigarh University');
  });

  test('hero is visible immediately, never stuck hidden', async ({page}) => {
    await page.goto('/');
    for (const sel of ['.hero-front', '.hero-copy h1', '.hero-signup']) {
      expect(Number(await page.locator(sel).evaluate(e => getComputedStyle(e).opacity)), sel).toBeGreaterThan(0.95);
    }
  });

  test('FAQ questions open and close', async ({page}) => {
    await page.goto('/#faq');
    const questions = page.locator('.faq-item button');
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < count; i++) {
      const q = questions.nth(i);
      await q.click();
      await expect(q).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#' + await q.getAttribute('aria-controls'))).toBeVisible();
      await q.click();
      await expect(q).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('rules page lists the whole run of show', async ({page}) => {
    await page.goto('/event-rules');
    const items = page.locator('.run-of-show li');
    await expect(items).toHaveCount(6);
    for (const label of ['Doors open', 'Submissions close', 'Reviews done', 'Voting opens', 'Voting closes', 'Results']) {
      await expect(page.locator('.run-of-show')).toContainText(label);
    }
    await expect(page.locator('.run-of-show')).not.toContainText(/\d{1,2}:\d{2}/); // no timings published
    await page.locator('.rules-body').getByRole('link', {name: /Enter the portal/}).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
