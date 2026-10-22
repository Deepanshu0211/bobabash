import {test, expect} from '@playwright/test';
import {ACCOUNTS, AUTH, ORGANIZER_ROUTES, PARTICIPANT_ROUTES, REVIEWER_ROUTES, signIn} from './helpers';

const PROTECTED = [...PARTICIPANT_ROUTES, ...REVIEWER_ROUTES, ...ORGANIZER_ROUTES, '/projects/00000000-0000-4000-8000-000000000000'];
const API = ['/api/me', '/api/event', '/api/projects', '/api/my-submission', '/api/voting/eligibility', '/api/voting/projects', '/api/voting/receipt',
  '/api/reviewer/assignments', '/api/admin/overview', '/api/admin/submissions', '/api/admin/reviews', '/api/admin/results', '/api/admin/audit-logs'];

test.describe('signed out', () => {
  for (const route of PROTECTED) {
    test(`${route} redirects to login`, async ({page}) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login\?next=/);
      expect(decodeURIComponent(page.url())).toContain('next=' + route);
    });
  }
  test('every API refuses with 401 JSON', async ({request}) => {
    for (const path of API) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect((await res.json()).error, path).toBeTruthy();
    }
  });
});

test.describe('login form', () => {
  test('rejects an email that is not on the roster', async ({page}) => {
    await signIn(page, ACCOUNTS.stranger);
    await expect(page.locator('.form-message')).toContainText('isn’t on the event roster');
    await expect(page).toHaveURL(/\/login/);
  });
  test('rejects a malformed email before sending', async ({page}) => {
    await page.goto('/login');
    await page.getByLabel('Registered email').fill('not-an-email');
    await page.getByRole('button', {name: /Enter the portal/}).click();
    expect(await page.getByLabel('Registered email').evaluate((e: HTMLInputElement) => e.validity.valid)).toBe(false);
  });
  test('team emails are asked for the team code, and a wrong one is refused', async ({page}) => {
    test.skip(!process.env.ORGANIZER_ACCESS_CODE, 'no organizer code configured');
    await signIn(page, ACCOUNTS.organizer, 'definitely-wrong');
    await expect(page.locator('.form-message')).toContainText('isn’t right');
    await expect(page).toHaveURL(/login/);
  });
  test('an expired or broken sign-in link explains itself', async ({page}) => {
    await page.goto('/auth/callback?code=broken&next=%2Fdashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.error-notice')).toContainText('sign-in link');
  });
  test('old /auth link still works', async ({page}) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('participant cannot reach other areas', () => {
  test.use({storageState: AUTH.participant});
  for (const route of [...REVIEWER_ROUTES, ...ORGANIZER_ROUTES]) {
    test(`${route} bounces to dashboard`, async ({page}) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
  test('organizer and reviewer APIs answer 403', async ({request}) => {
    for (const path of ['/api/admin/overview', '/api/admin/submissions', '/api/admin/results', '/api/reviewer/assignments']) {
      expect((await request.get(path)).status(), path).toBe(403);
    }
  });
  test('participant APIs answer 200 and never leak totals', async ({request}) => {
    const me = await (await request.get('/api/me')).json();
    expect(me.roles).toEqual(['participant']);
    expect(me.email).toBe(ACCOUNTS.participant);
    for (const path of ['/api/event', '/api/projects', '/api/voting/eligibility', '/api/my-submission']) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const projects = JSON.stringify(await (await request.get('/api/projects')).json());
    expect(projects).not.toMatch(/"votes"|"email"|participant_id/);
  });
});

test.describe('API contract (participant)', () => {
  test.use({storageState: AUTH.participant});
  const ballot = (request: import('@playwright/test').APIRequestContext, data: unknown, headers: Record<string, string> = {}) =>
    request.post('/api/voting/ballot', {data, headers: {Origin: process.env.QA_BASE_URL ?? 'http://localhost:3000', ...headers}});

  test('malformed ballots are 400', async ({request}) => {
    expect((await ballot(request, {submission_ids: ['a', 'b']})).status()).toBe(400);
    expect((await ballot(request, {submission_ids: ['x', 'x', 'y']})).status()).toBe(400);
    expect((await ballot(request, {submission_ids: ['a', 'b', 'c'], participant_id: 'someone'})).status()).toBe(400);
    expect((await ballot(request, 'not json')).status()).toBe(400);
  });
  test('cross-site writes are blocked', async ({request}) => {
    const res = await ballot(request, {submission_ids: ['a', 'b', 'c']}, {Origin: 'https://evil.example'});
    expect(res.status()).toBe(403);
  });
  test('ballot outside the voting phase is refused, not stored', async ({request}) => {
    const event = await (await request.get('/api/event')).json();
    test.skip(event.phase === 'voting', 'voting is open; ballots are tested in the database suite instead');
    const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
    expect((await ballot(request, {submission_ids: ids})).status()).toBe(403);
    expect((await request.get('/api/voting/receipt')).status()).toBe(404);
  });
});
