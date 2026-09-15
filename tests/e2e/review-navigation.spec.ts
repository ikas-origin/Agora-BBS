import { expect, test } from '@playwright/test';

type LoginEnvelope = {
  code: number;
  data: {
    token: string;
    user: { unlock_level: number; capabilities: string[] };
  };
};

test('L3 user can discover and open anonymous review', async ({ request, page }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: 'demo_l3_a', password: 'password' },
  });
  expect(response.ok()).toBeTruthy();

  const login = await response.json() as LoginEnvelope;
  expect(login.data.user.unlock_level).toBe(3);
  expect(login.data.user.capabilities).toContain('blind_review');

  await page.goto('/');
  await page.evaluate((token) => localStorage.setItem('token', token), login.data.token);
  await page.reload();

  const navigationEntry = page.getByRole('link', { name: '匿名盲审', exact: true });
  await expect(navigationEntry).toBeVisible();
  await navigationEntry.click();
  await expect(page.getByRole('heading', { name: '匿名盲审', exact: true })).toBeVisible();
  await expect(page.getByText('匿名盲审将在达到 L3 后解锁')).toHaveCount(0);

  await page.goto('/profile');
  await expect(page.getByRole('link', { name: '进入匿名盲审' })).toBeVisible();
});
