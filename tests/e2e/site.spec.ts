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
  const menuButton = page.getByRole('button', { name: 'Apri il menu' });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole('navigation', { name: 'Principale' }).getByRole('link', { name: 'Eventi' }).click();
  await expect(page).toHaveURL(/\/eventi\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Eventi' })).toBeVisible();
});

test('il menu mobile si apre, si chiude e mantiene il focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Comportamento specifico della navigazione mobile');
  await page.goto('/');

  const menuButton = page.locator('[data-menu-toggle]');
  const navigation = page.getByRole('navigation', { name: 'Principale' });
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAccessibleName('Apri il menu');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();

  await menuButton.click();
  await expect(menuButton).toHaveAccessibleName('Chiudi il menu');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Eventi' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menuButton).toBeFocused();
});

test('un evento storico è raggiungibile dall’archivio', async ({ page }) => {
  await page.goto('/eventi/2025/');
  const firstEvent = page.locator('.event-card h2 a').first();
  await expect(firstEvent).toBeVisible();
  await firstEvent.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Dettagli' })).toBeVisible();
});

test('le biografie dei soci sono renderizzate dal Markdown', async ({ page }) => {
  await page.goto('/soci/daniele-morosinotto/');
  await expect(page.locator('.person-profile .prose > p')).toHaveCount(5);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Sono un appassionato di tecnologia/);

  await page.goto('/soci/alessandro-calzavara/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Alessandro Calzavara, socio di XeDotNet.');
});
