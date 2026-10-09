import { expect, test } from '@playwright/test';

for (const path of ['/', '/eventi/', '/eventi/2025/']) {
  test(`${path} permette di aprire un evento dalla data e dallo spazio vuoto della card`, async ({
    page,
  }) => {
    for (const target of ['data', 'spazio vuoto']) {
      await page.goto(path);
      test.skip(
        (await page.locator('.event-card').count()) === 0,
        'Non ci sono eventi in calendario da aprire.',
      );
      const card = page.locator('.event-card').first(),
        link = card.getByRole('link'),
        title = (await card.locator('h2').textContent()) ?? '',
        href = await link.getAttribute('href'),
        destination = new URL(href ?? '', page.url()).href;
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAccessibleName(title);
      await card.scrollIntoViewIfNeeded();
      const position = await card.evaluate((element, area) => {
        if (area === 'spazio vuoto') {
          return { x: 8, y: 8 };
        }
        const cardBox = element.getBoundingClientRect(),
          dateBox = element.querySelector('time')!.getBoundingClientRect();
        return {
          x: dateBox.x - cardBox.x + dateBox.width / 2,
          y: dateBox.y - cardBox.y + dateBox.height / 2,
        };
      }, target);
      await card.click({ position });
      await expect(page).toHaveURL(destination);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    }
  });
}

test('le card evento hanno una sola tappa di tabulazione e il focus su tutto il perimetro', async ({
  page,
}) => {
  await page.goto('/eventi/2025/');
  const links = page.locator('.event-card h2 a'),
    firstLink = links.first(),
    destination = new URL(
      (await firstLink.getAttribute('href')) ?? '',
      page.url(),
    ).href;
  await firstLink.focus();
  await page.keyboard.press('Tab');
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(firstLink).toBeFocused();
  const focus = await firstLink.evaluate((element) => {
    const ring = getComputedStyle(element, '::after');
    return { outlineStyle: ring.outlineStyle, outlineWidth: ring.outlineWidth };
  });
  expect(focus.outlineStyle).toBe('solid');
  expect(focus.outlineWidth).not.toBe('0px');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(destination);
});

test('il collegamento all’archivio raggiunge la sezione sotto la navigazione fissa', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Esplora il nostro archivio' }).click();
  await expect(page).toHaveURL(/\/eventi\/#archivio$/u);
  const archive = page.getByRole('heading', { name: 'Archivio', exact: true });
  await expect(archive).toBeInViewport();
  await expect
    .poll(async () => {
      const headingBox = await archive.boundingBox(),
        headerBox = await page.locator('[data-site-header]').boundingBox();
      return (
        (headingBox?.y ?? -Infinity) -
        ((headerBox?.y ?? 0) + (headerBox?.height ?? 0))
      );
    })
    .toBeGreaterThan(0);

  await page.goto('/eventi/#archivio');
  await expect(archive).toBeInViewport();
});

test.describe('i collegamenti PayPal funzionano senza JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ['/', '/chi-siamo/']) {
    test(`${path} espone link esterni distinti per quota e donazione`, async ({
      page,
      context,
    }) => {
      await page.goto(path);
      const actions = page.locator('.support-actions');
      await expect(actions.getByRole('button')).toHaveCount(0);
      await expect(actions.getByRole('link')).toHaveCount(2);
      await expect(actions).toContainText('IT47 E084 5236 1800 0000 0109 908');
      await context.route('https://www.paypal.com/**', async (route) => {
        await route.fulfill({
          contentType: 'text/html',
          body: '<p>Destinazione PayPal</p>',
        });
      });

      for (const [label, buttonId] of [
        ['Diventa socio su PayPal', 'UGBFVE3T96F2Y'],
        ['Fai una donazione su PayPal', '5ADXWWH82ZSBY'],
      ]) {
        const link = actions.getByRole('link', { name: label }),
          href = `https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=${buttonId}`;
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link).toHaveAccessibleName(
          `${label} (si apre in una nuova scheda)`,
        );
        const popupPromise = page.waitForEvent('popup');
        await link.click();
        const popup = await popupPromise;
        await expect(popup).toHaveURL(href);
        await popup.close();
      }
    });
  }
});
