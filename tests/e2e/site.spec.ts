import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const representativePages = ['/', '/eventi/', '/eventi/2025/', '/soci/', '/chi-siamo/', '/contatti/', '/privacy-policy/'];

for (const path of representativePages) {
  test(`${path} non presenta violazioni axe`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('la navigazione principale raggiunge gli eventi', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principale' }).getByRole('link', { name: 'Eventi' }).click();
  await expect(page).toHaveURL(/\/eventi\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Eventi' })).toBeVisible();
});

test('un evento storico è raggiungibile dall’archivio', async ({ page }) => {
  await page.goto('/eventi/2025/');
  const firstEvent = page.locator('.event-card h2 a').first();
  await expect(firstEvent).toBeVisible();
  await firstEvent.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Dettagli' })).toBeVisible();
});
