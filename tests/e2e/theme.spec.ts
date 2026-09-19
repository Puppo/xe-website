import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

const themePreferences = ['system', 'light', 'dark'] as const,
  themeLabels = {
    dark: 'Scuro',
    light: 'Chiaro',
    system: 'Sistema',
  } as const;

async function expectThemeIcon(
  control: Locator,
  preference: (typeof themePreferences)[number],
) {
  await expect(control).toHaveAttribute('data-theme-preference', preference);
  await expect(control.locator('.theme-value')).toHaveText(
    themeLabels[preference],
  );
  for (const icon of themePreferences) {
    const expectation = expect(control.locator(`[data-theme-icon="${icon}"]`));
    if (icon === preference) {
      await expectation.toBeVisible();
    } else {
      await expectation.toBeHidden();
    }
  }
}

test('il tema segue il sistema, ricorda la scelta e torna automatico', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const theme = page.getByLabel('Tema', { exact: true }),
    themeControl = page.locator('.theme-control');
  await expect(theme).toHaveValue('system');
  await expectThemeIcon(themeControl, 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectThemeIcon(themeControl, 'system');

  await theme.selectOption('dark');
  await page.reload();
  await expect(theme).toHaveValue('dark');
  await expectThemeIcon(themeControl, 'dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.goto('/eventi/');
  await expect(theme).toHaveValue('dark');
  await expectThemeIcon(themeControl, 'dark');
  await theme.selectOption('light');
  await expectThemeIcon(themeControl, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await theme.selectOption('system');
  await expectThemeIcon(themeControl, 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(theme).toHaveValue('system');
  await expectThemeIcon(themeControl, 'system');
});

test('il selettore del tema funziona con la tastiera', async ({ page }) => {
  await page.goto('/');
  const theme = page.getByLabel('Tema', { exact: true });
  await theme.focus();
  await expect(theme).toBeFocused();
  await theme.press('End');
  await expect(theme).toHaveValue('dark');
  await expectThemeIcon(page.locator('.theme-control'), 'dark');
});

test('il selettore del tema si adatta tra desktop e mobile', async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto('/');
  const header = page.locator('[data-site-header]'),
    picker = page.locator('.theme-picker'),
    chevron = page.locator('.theme-chevron'),
    [pickerBox, chevronBox] = await Promise.all([
      picker.boundingBox(),
      chevron.boundingBox(),
    ]);
  expect(pickerBox).not.toBeNull();
  expect(chevronBox).not.toBeNull();
  expect(
    Math.abs(
      (pickerBox?.y ?? 0) +
        (pickerBox?.height ?? 0) / 2 -
        (chevronBox?.y ?? 0) -
        (chevronBox?.height ?? 0) / 2,
    ),
  ).toBeLessThan(1);
  await expect(header.locator('svg')).toHaveCount(0);
  expect(
    await header
      .locator('.icon-mask')
      .evaluateAll((icons) =>
        icons.every((icon) =>
          getComputedStyle(icon).maskImage.includes('/images/icons/'),
        ),
      ),
  ).toBe(true);
  await expect(page.locator('.theme-value')).toBeVisible();

  await page.setViewportSize({ height: 667, width: 375 });
  await expect(page.locator('.theme-value')).toBeHidden();
  await expect(chevron).toBeHidden();
  await expect(page.locator('.theme-control label')).toHaveCSS(
    'clip-path',
    'inset(50%)',
  );
  await expect(page.locator('.theme-control label')).toHaveCSS('width', '1px');
  await expect(picker).toHaveCSS('width', '44px');
  await expect(picker).toHaveCSS('height', '44px');
  await expect(page.locator('[data-theme-icon="system"]')).toBeVisible();
});

test('la scelta funziona anche se localStorage non è disponibile', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage disabled');
      },
    });
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
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations, path).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        path,
      ).toBe(true);
    }
  });
}

test('senza JavaScript il tema di sistema resta disponibile', async ({
  browser,
}) => {
  const context = await browser.newContext({
      colorScheme: 'dark',
      javaScriptEnabled: false,
    }),
    page = await context.newPage();
  await page.goto('http://127.0.0.1:4325/');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(18, 22, 24)',
  );
  await expect(page.getByLabel('Tema', { exact: true })).toBeHidden();
  await context.close();
});
