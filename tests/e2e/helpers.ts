import {expect, type Page, type ConsoleMessage} from '@playwright/test';

export const ACCOUNTS = {
  participant: 'dy3239073+test1@gmail.com',
  participant2: 'dy3239073+test3@gmail.com',
  organizer: 'dy3239073@gmail.com',
  stranger: 'qa-not-on-roster@example.com'
};
export const AUTH = {
  participant: 'tests/e2e/.auth/participant.json',
  organizer: 'tests/e2e/.auth/organizer.json'
};

export const PUBLIC_ROUTES = ['/', '/event-rules', '/login'];
export const PARTICIPANT_ROUTES = ['/dashboard', '/projects', '/results', '/submission', '/voting', '/voting/receipt'];
export const REVIEWER_ROUTES = ['/reviewer/queue'];
export const ORGANIZER_ROUTES = ['/admin/overview', '/admin/submissions', '/admin/reviews', '/admin/shortlist', '/admin/voting', '/admin/results', '/admin/people'];
export const VIEWPORTS = {phone: {width: 375, height: 812}, tablet: {width: 768, height: 1024}, desktop: {width: 1440, height: 900}};

/** Signs in through the real login form (direct entry). */
export async function signIn(page: Page, email: string, code = '') {
  await page.goto('/login');
  await page.getByLabel('Registered email').fill(email);
  await page.getByRole('button', {name: /Enter the portal/}).click();
  // Volunteers and organizers get a second step asking for the team code.
  if (!code) return;
  const codeField = page.getByLabel('Team access code');
  await codeField.waitFor({timeout: 30_000});
  await codeField.fill(code);
  await page.getByRole('button', {name: /Unlock the portal/}).click();
}

/** Collects console errors and uncaught page errors for the lifetime of a page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  const ignored = [/Download the React DevTools/, /\[Fast Refresh\]/, /favicon\.ico/];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error' && !ignored.some(r => r.test(m.text()))) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('response', r => {
    const url = r.url();
    if (r.status() >= 500 && url.startsWith(page.url().split('/').slice(0, 3).join('/'))) errors.push(`HTTP ${r.status()} ${url}`);
  });
  return errors;
}

/** Page-level health: one h1, no sideways scroll, all images loaded, every image has alt, every button is named. */
export async function expectHealthyPage(page: Page) {
  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const imgs = [...document.images];
    return {
      h1: document.querySelectorAll('h1').length,
      overflow: doc.scrollWidth - doc.clientWidth,
      brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
      missingAlt: imgs.filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src')),
      unnamedButtons: [...document.querySelectorAll('button')].filter(b => !(b.textContent?.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).length,
      emDashes: (document.body.innerText.match(/—/g) ?? []).length
    };
  });
  expect(report.h1, 'exactly one h1').toBe(1);
  expect(report.overflow, 'no horizontal scroll').toBeLessThanOrEqual(1);
  expect(report.brokenImages, 'all images load').toEqual([]);
  expect(report.missingAlt, 'images have alt text').toEqual([]);
  expect(report.unnamedButtons, 'every button has a name').toBe(0);
  expect(report.emDashes, 'no em dashes in copy').toBe(0);
}

/** Every same-origin link on the page, deduplicated (fragments kept separately). */
export async function internalLinks(page: Page) {
  return page.evaluate(() => {
    const origin = location.origin;
    const out = new Set<string>();
    document.querySelectorAll('a[href]').forEach(a => {
      const url = new URL((a as HTMLAnchorElement).href);
      if (url.origin === origin && !url.pathname.startsWith('/_next')) out.add(url.pathname + url.search + url.hash);
    });
    return [...out];
  });
}

export async function externalLinks(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('a[href^="http"]')]
    .filter(a => new URL((a as HTMLAnchorElement).href).origin !== location.origin)
    .map(a => ({href: (a as HTMLAnchorElement).href, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? ''})));
}
