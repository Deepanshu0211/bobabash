import {chromium, type FullConfig} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {ACCOUNTS, AUTH, signIn} from './helpers';

// Signs each role in once and saves the session, so the suites don't hit the sign-in throttle.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync('tests/e2e/.auth', {recursive: true});
  const browser = await chromium.launch();
  for (const [role, email, code] of [
    ['participant', ACCOUNTS.participant, ''],
    ['organizer', ACCOUNTS.organizer, process.env.ORGANIZER_ACCESS_CODE ?? '']
  ] as const) {
    const page = await browser.newPage({baseURL});
    await signIn(page, email, code);
    try {
      await page.waitForURL('**/dashboard', {timeout: 30_000});
    } catch {
      const alert = await page.locator('.form-message, [role=alert]').allInnerTexts();
      throw new Error(`Could not sign in as ${role} (${email}): ${alert.join(' ') || 'no message'}. ` +
        'Is the dev server running with SUPABASE_SERVICE_ROLE_KEY, and was supabase/seed-test.sql applied?');
    }
    await page.context().storageState({path: AUTH[role]});
    await page.close();
  }
  await browser.close();
}
