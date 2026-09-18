import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('il tema segue il sistema, ricorda la scelta e torna automatico', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const theme = page.getByLabel('Tema', { exact: true });
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await theme.selectOption('dark');
  await page.reload();
  await expect(theme).toHaveValue('dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.goto('/eventi/');
  await expect(theme).toHaveValue('dark');
  await theme.selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await theme.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(theme).toHaveValue('system');
});

test('la scelta funziona anche se localStorage non è disponibile', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
  });
  await page.goto('/');
  await page.getByLabel('Tema', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`layout e contrasto nel tema ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of ['/', '/eventi/', '/soci/', '/chi-siamo/']) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations, path).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });
}

test('senza JavaScript il tema di sistema resta disponibile', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4325/');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 22, 24)');
  await expect(page.getByLabel('Tema', { exact: true })).toBeHidden();
  await context.close();
});
