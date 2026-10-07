import { expect, test } from '@playwright/test';

const endpoints = [
  { route: '/attendance/raw', api: '/api/attendance/raw', title: 'Raw Attendance' },
  { route: '/attendance/events', api: '/api/attendance/events', title: 'Attendance Events' },
  {
    route: '/attendance/rule-results',
    api: '/api/attendance/rule-results',
    title: 'Rule Results',
  },
  { route: '/attendance/cycles', api: '/api/attendance/cycles', title: 'Attendance Cycles' },
];

async function configureSession(page: import('@playwright/test').Page) {
  await page.route(
    (url) => url.pathname === '/api/auth/me',
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            email: 'operator@example.test',
            role: 'OPERATOR',
            status: 'ACTIVE',
          },
        }),
      }),
  );
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('token', 'e2e-test-token'));
  await page.route(
    (url) => url.pathname === '/api/auth/logout',
    async (route) => route.fulfill({ status: 200, body: '{}' }),
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/attendance/'),
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }),
      }),
  );
}

test('attendance navigation exposes the four verified read-only pages', async ({ page }) => {
  await configureSession(page);
  await page.goto('/');
  for (const item of endpoints) {
    await expect(page.getByRole('link', { name: item.title })).toHaveAttribute('href', item.route);
  }
});

for (const item of endpoints) {
  test(`${item.title} route renders and requests its verified API`, async ({ page }) => {
    await configureSession(page);
    const requestPromise = page.waitForRequest(
      (request) => new URL(request.url()).pathname === item.api,
    );
    await page.goto(item.route);
    await expect(page.getByRole('heading', { name: item.title })).toBeVisible();
    await expect(page.getByText('No attendance records found.')).toBeVisible();
    const request = await requestPromise;
    expect(request.headers().authorization).toBe('Bearer e2e-test-token');
  });
}

test('attendance loading state is shown while the API is pending', async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/auth/me',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'u1', email: 'operator@example.test', role: 'OPERATOR', status: 'ACTIVE' },
        }),
      }),
  );
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('token', 'e2e-test-token'));
  await page.route(
    (url) => url.pathname === '/api/attendance/raw',
    async () => new Promise(() => {}),
  );
  await page.goto('/attendance/raw');
  await expect(page.getByRole('status')).toContainText('Loading raw attendance');
});

test('attendance error state is human-readable and retryable', async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/auth/me',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'u1', email: 'operator@example.test', role: 'OPERATOR', status: 'ACTIVE' },
        }),
      }),
  );
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('token', 'e2e-test-token'));
  let requests = 0;
  await page.route(
    (url) => url.pathname === '/api/attendance/raw',
    async (route) => {
      requests += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'secret SQL details', details: null },
          meta: {},
        }),
      });
    },
  );
  await page.goto('/attendance/raw');
  await expect(page.getByRole('alert')).toContainText(
    'Attendance records could not be loaded. Try again.',
  );
  await expect(page.getByRole('alert')).not.toContainText('secret SQL details');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => requests).toBe(2);
});

test('pagination and supported filters are sent to the backend; UI is read-only', async ({
  page,
}) => {
  await configureSession(page);
  const requestedUrls: URL[] = [];
  await page.unroute((url) => url.pathname.startsWith('/api/attendance/'));
  await page.route(
    (url) => url.pathname === '/api/attendance/events',
    async (route) => {
      requestedUrls.push(new URL(route.request().url()));
      const requestedPage = Number(new URL(route.request().url()).searchParams.get('page') ?? 1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { page: requestedPage, pageSize: 20, total: 21, totalPages: 2 },
        }),
      });
    },
  );
  await page.goto('/attendance/events');
  await page.getByLabel('Device ID').fill('device-7');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect.poll(() => requestedUrls.length).toBe(2);
  expect(requestedUrls[1].searchParams.get('deviceId')).toBe('device-7');
  expect(requestedUrls[1].searchParams.get('page')).toBe('1');
  await page.getByLabel('Rows per page').selectOption('50');
  await expect.poll(() => requestedUrls.length).toBe(3);
  expect(requestedUrls[2].searchParams.get('pageSize')).toBe('50');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => requestedUrls.length).toBe(4);
  expect(requestedUrls[3].searchParams.get('page')).toBe('2');
  await expect(
    page.getByRole('button', {
      name: /edit|delete|create|approve|reject|retry|normalize|reprocess/i,
    }),
  ).toHaveCount(0);
});

test('device list and dashboard remain reachable and logout clears the session', async ({
  page,
}) => {
  await configureSession(page);
  await page.route(
    (url) => url.pathname === '/api/devices',
    async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/devices');
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
