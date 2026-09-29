import { expect, test } from '@playwright/test';

test('il collegamento “Vai al contenuto” appare al focus e raggiunge il contenuto', async ({
  page,
}) => {
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: 'Vai al contenuto' });

  expect((await skipLink.boundingBox())?.y ?? Infinity).toBeLessThan(0);

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  expect((await skipLink.boundingBox())?.y ?? -Infinity).toBeGreaterThan(0);

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#contenuto$/);
  await expect(page.locator('main#contenuto')).toBeFocused();
});

test('gli elementi interattivi mostrano un indicatore di focus visibile', async ({
  page,
}) => {
  await page.goto('/');
  for (const name of ['Vai al contenuto', 'XeDotNet, pagina iniziale']) {
    await page.keyboard.press('Tab');
    const focused = page.getByRole('link', { name });
    await expect(focused).toBeFocused();
    const outline = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).toBe('solid');
    expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
  }
});

test('la tabulazione attraversa l’intestazione in ordine logico', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const stops = [
    page.getByRole('link', { name: 'Vai al contenuto' }),
    page.getByRole('link', { name: 'XeDotNet, pagina iniziale' }),
  ];
  if (testInfo.project.name === 'mobile') {
    stops.push(page.getByRole('button', { name: 'Apri il menu' }));
  } else {
    const navigation = page.getByRole('navigation', { name: 'Principale' });
    for (const label of ['Home', 'Chi siamo', 'Eventi', 'Soci', 'Contatti']) {
      stops.push(navigation.getByRole('link', { name: label }));
    }
  }
  stops.push(page.getByLabel('Tema', { exact: true }));

  for (const stop of stops) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
  }
});

test('con prefers-reduced-motion le transizioni sono disattivate', async ({
  page,
}) => {
  await page.goto('/');
  const subscribe = page.getByRole('button', { name: 'Iscriviti' });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe('smooth');
  expect(
    await subscribe.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).not.toBe('0s');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe('auto');
  expect(
    await subscribe.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
});
