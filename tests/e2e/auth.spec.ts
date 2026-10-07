// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

/**
 * P16.8.34 UI Authentication verification
 * Flow:
 * 1. Open login page
 * 2. Login with test credentials
 * 3. Verify redirect to dashboard
 * 4. Verify token stored in localStorage (redacted)
 * 5. Refresh page and ensure session persists
 * 6. Call protected endpoint using token
 * 7. Logout via UI and verify redirect to login
 * 8. Verify token cleared and protected endpoint rejects
 */

test('UI authentication flow', async ({ page }) => {
  // 1. Open login page
  await page.goto('http://localhost:5173/login');
  await expect(page).toHaveURL(/\/login$/);

  // 2. Fill credentials and submit
  await page.fill('input#email', 'test_valid@example.com');
  await page.fill('input#password', 'admin123');
  await page.click('button:has-text("Login")');

  // 3. Verify navigation to dashboard (root path)
  // Wait for dashboard header to appear
  await page.waitForSelector('h1:has-text("Dashboard")');

  // 4. Verify token exists in localStorage (redacted in logs)
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  // 5. Refresh page and ensure session persists
  await page.reload();
  await expect(page).toHaveURL(/\//);
  const tokenAfterReload = await page.evaluate(() => localStorage.getItem('token'));
  expect(tokenAfterReload).toBe(token);

  // 6. Call protected endpoint using request API with the token
  const response = await page.request.get('http://localhost:3000/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.user?.id).toBeTruthy();

  // 7. Logout via UI
  await page.click('button.logout-btn');
  await expect(page).toHaveURL(/\/login$/);

  // 8. Verify token cleared
  const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('token'));
  expect(tokenAfterLogout).toBeNull();

  // 9. Ensure protected endpoint now rejects (without token)
  const afterLogoutResp = await page.request.get('http://localhost:3000/api/auth/me');
  expect(afterLogoutResp.status()).toBe(401);
});
