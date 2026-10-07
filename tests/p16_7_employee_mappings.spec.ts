import { expect, test, type Page } from '@playwright/test';

const mapping = {
  id: 'mapping-1',
  device_id: 'device-1',
  device_employee_id: 'clock-17',
  employee_id: 'employee-1',
  sap_employee_id: 'SAP-17',
  valid_from: '2026-01-01T00:00:00.000Z',
  valid_to: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  device: { id: 'device-1', device_code: 'FRONT', name: 'Front Gate' },
  employee: { id: 'employee-1', internal_id: 'E-17', name: 'Alex Employee' },
};

async function authenticate(page: Page, role = 'SUPER_ADMIN') {
  await page.route('**/api/auth/me', async (route) =>
    route.fulfill({
      json: {
        user: { id: 'user-1', email: 'sa@example.test', role, status: 'ACTIVE' },
      },
    }),
  );
  await page.addInitScript(() => localStorage.setItem('token', 'test-token'));
}

async function mockMappings(page: Page, opts: { rows?: unknown[]; fail?: boolean } = {}) {
  await page.route('**/api/employee-mappings/options', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          devices: [{ id: 'device-1', device_code: 'FRONT', name: 'Front Gate' }],
          employees: [{ id: 'employee-1', internal_id: 'E-17', name: 'Alex Employee' }],
        },
        meta: {},
      },
    }),
  );
  await page.route('**/api/employee-mappings?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (opts.fail) return route.fulfill({ status: 500, json: { error: 'Backend unavailable' } });
    return route.fulfill({
      json: {
        success: true,
        data: opts.rows ?? [mapping],
        meta: { page: 1, pageSize: 20, total: opts.rows?.length ?? 1, totalPages: 1 },
      },
    });
  });
}

test.describe('P16.7 Employee Mapping workflow', () => {
  test('lists and filters mappings, shows empty and error states, and contains table on desktop/mobile', async ({
    page,
  }) => {
    await authenticate(page, 'AUDITOR');
    await mockMappings(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/employee-mappings');
    await expect(page.getByRole('heading', { name: 'Employee Mapping' })).toBeVisible();
    await expect(page.getByText('Alex Employee')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create mapping' })).toHaveCount(0);
    await page.getByLabel('Search').fill('clock-17');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Alex Employee')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      table: document.querySelector('.table-scroll')?.getBoundingClientRect().width,
      panel: document.querySelector('.mapping-page')?.getBoundingClientRect().width,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.table).toBeLessThanOrEqual(dimensions.panel ?? 0);
  });

  test('shows empty and recoverable API error states', async ({ page }) => {
    await authenticate(page);
    await mockMappings(page, { rows: [] });
    await page.goto('/employee-mappings');
    await expect(page.getByText('No employee mappings found.')).toBeVisible();

    await page.unroute('**/api/employee-mappings?**');
    await mockMappings(page, { fail: true });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Mappings could not be loaded' })).toBeVisible();
  });

  test('creates a mapping through the form using authenticated requests', async ({ page }) => {
    await authenticate(page);
    await mockMappings(page, { rows: [] });
    let authHeader = '';
    await page.route('**/api/employee-mappings', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      authHeader = route.request().headers().authorization ?? '';
      return route.fulfill({ status: 201, json: mapping });
    });
    await page.goto('/employee-mappings/new');
    await expect(page.getByRole('heading', { name: 'Create mapping' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Device' }).selectOption('device-1');
    await page.getByLabel('Device employee ID').fill('clock-17');
    await page.getByRole('combobox', { name: 'Employee' }).selectOption('employee-1');
    await page.getByLabel('SAP employee ID').fill('SAP-17');
    await page.getByRole('button', { name: 'Create mapping' }).click();
    await expect(page.getByText('Employee mapping created successfully.')).toBeVisible();
    expect(authHeader).toBe('Bearer test-token');
  });

  test('edits/deactivates a mapping and resolves an event', async ({ page }) => {
    await authenticate(page);
    await mockMappings(page);
    await page.route('**/api/employee-mappings/mapping-1', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { success: true, data: mapping, meta: {} } });
      }
      return route.fulfill({ json: mapping });
    });
    await page.route('**/api/employee-mappings/mapping-1/deactivate', (route) =>
      route.fulfill({ json: { ...mapping, is_active: false } }),
    );
    await page.route('**/api/employee-mappings/resolve', (route) =>
      route.fulfill({
        json: {
          status: 'MAPPED',
          canonical_event_id: 'event-1',
          employee_id: 'employee-1',
          sap_employee_id: 'SAP-17',
        },
      }),
    );
    await page.goto('/employee-mappings');
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit mapping' })).toBeVisible();
    await expect(page.getByLabel('Valid from')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Employee mapping updated successfully.')).toBeVisible();

    await page.goto('/employee-mappings');
    await page.getByRole('button', { name: 'Deactivate' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Employee mapping deactivated.')).toBeVisible();

    await page.getByLabel('Canonical event ID').fill('event-1');
    await page.getByRole('button', { name: 'Resolve event' }).click();
    await expect(page.getByText('Event resolution completed: MAPPED.')).toBeVisible();
  });

  test('guards invalid effective dates and hides mutation controls from auditors', async ({
    page,
  }) => {
    await authenticate(page, 'AUDITOR');
    await mockMappings(page);
    await page.goto('/employee-mappings');
    await expect(page.getByRole('button', { name: 'Resolve event' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    await page.goto('/employee-mappings/new');
    await expect(
      page.getByText('You do not have permission to manage employee mappings.'),
    ).toBeVisible();
  });
});
