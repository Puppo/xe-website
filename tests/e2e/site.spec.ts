import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const representativePages = [
  '/',
  '/eventi/',
  '/eventi/2025/',
  '/eventi/tech-pub-gennaio-2025/',
  '/soci/',
  '/chi-siamo/',
  '/contatti/',
  '/privacy-policy/',
];

for (const path of representativePages) {
  test(`${path} non presenta violazioni axe`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('Dal 2006 ad oggi ha lo stesso layout su mobile e desktop', async ({
  page,
  isMobile,
}) => {
  for (const width of isMobile ? [320, 412] : [1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const history = page.locator('.community-history');
    const from = await history.locator('.history-from').boundingBox();
    const year = await history.locator('.history-year').boundingBox();
    const to = await history.locator('.history-to').boundingBox();
    const action = await history.locator('.history-action').boundingBox();

    expect(from).not.toBeNull();
    expect(year).not.toBeNull();
    expect(to).not.toBeNull();
    expect(action).not.toBeNull();
    await expect(history.locator('.history-line')).toContainText(
      /Dal\s+2006\s+ad oggi\s+per crescere insieme\./,
    );

    expect(
      (from?.x ?? Infinity) + (from?.width ?? Infinity),
    ).toBeLessThanOrEqual(year?.x ?? -Infinity);
    expect(
      (year?.x ?? Infinity) + (year?.width ?? Infinity),
    ).toBeLessThanOrEqual(to?.x ?? -Infinity);
    expect((from?.y ?? Infinity) < (year?.y ?? 0) + (year?.height ?? 0)).toBe(
      true,
    );
    expect((from?.y ?? 0) + (from?.height ?? 0)).toBeGreaterThan(
      year?.y ?? Infinity,
    );
    expect((to?.y ?? Infinity) < (year?.y ?? 0) + (year?.height ?? 0)).toBe(
      true,
    );
    expect((to?.y ?? 0) + (to?.height ?? 0)).toBeGreaterThan(
      year?.y ?? Infinity,
    );
    const descriptionBox = await history
      .locator(':scope > p:not(.history-line)')
      .boundingBox();
    expect(descriptionBox).not.toBeNull();
    expect(Math.abs((from?.x ?? 0) - (descriptionBox?.x ?? 0))).toBeLessThan(2);
    expect(Math.abs((action?.x ?? 0) - (descriptionBox?.x ?? 0))).toBeLessThan(
      2,
    );
    expect(action?.y ?? -Infinity).toBeGreaterThan(
      (year?.y ?? 0) + (year?.height ?? 0),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('i sostenitori attuali mostrano tutti i loghi e i collegamenti', async ({
  page,
}) => {
  await page.goto('/');
  const section = page.locator('.partner-section');
  await expect(section.getByRole('heading', { level: 3 })).toHaveText([
    'Grazie per il supporto alle attività del gruppo',
    'Con il sostegno di',
  ]);

  const expectedPartners = [
    ['Hunext', 'https://www.hunext.com/'],
    ['Yalp', 'https://www.yalp.me/'],
    ['Sessionize', 'https://sessionize.com/'],
    ['Eventitech', 'https://eventitech.it/'],
  ];

  for (const [name, url] of expectedPartners) {
    const logo = section.getByRole('img', { name });
    await logo.scrollIntoViewIfNeeded();
    await expect(logo).toBeVisible();
    expect(
      await logo.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    ).toBe(true);
    await expect(section.getByRole('link', { name })).toHaveAttribute(
      'href',
      url,
    );
  }

  expect(
    await section
      .locator('.partners img')
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute('alt')),
      ),
  ).toEqual(expectedPartners.map(([name]) => name));
  await expect(section.getByRole('link')).toHaveCount(4);
});

test('la navigazione principale raggiunge gli eventi', async ({ page }) => {
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Apri il menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page
    .getByRole('navigation', { name: 'Principale' })
    .getByRole('link', { name: 'Eventi' })
    .click();
  await expect(page).toHaveURL(/\/eventi\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Eventi' }),
  ).toBeVisible();
});

test('la navigazione resta compatta e centrata', async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto('/');
  const header = page.locator('[data-site-header]'),
    desktopBox = await header.boundingBox(),
    desktopCenter = await page.evaluate(
      () => document.documentElement.clientWidth / 2,
    );
  expect(desktopBox).not.toBeNull();
  expect(desktopBox?.width ?? Infinity).toBeLessThan(800);
  expect(desktopBox?.height ?? Infinity).toBeLessThan(64);
  expect(
    Math.abs(
      (desktopBox?.x ?? 0) + (desktopBox?.width ?? 0) / 2 - desktopCenter,
    ),
  ).toBeLessThan(10);

  await page.setViewportSize({ height: 667, width: 375 });
  const mobileBox = await header.boundingBox(),
    mobileCenter = await page.evaluate(
      () => document.documentElement.clientWidth / 2,
    );
  expect(mobileBox).not.toBeNull();
  expect(mobileBox?.width ?? Infinity).toBeLessThan(220);
  expect(mobileBox?.height ?? Infinity).toBeLessThan(64);
  expect(
    Math.abs((mobileBox?.x ?? 0) + (mobileBox?.width ?? 0) / 2 - mobileCenter),
  ).toBeLessThan(10);

  await page.locator('[data-menu-toggle]').click();
  const menuBox = await page
    .getByRole('navigation', { name: 'Principale' })
    .boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.x ?? 0).toBeGreaterThanOrEqual(16);
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? Infinity)).toBeLessThanOrEqual(
    359,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('il menu mobile si apre, si chiude e mantiene il focus', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile',
    'Comportamento specifico della navigazione mobile',
  );
  await page.goto('/');

  const menuButton = page.locator('[data-menu-toggle]'),
    navigation = page.getByRole('navigation', { name: 'Principale' });
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
  await expect(
    page.getByRole('heading', { level: 2, name: 'Dettagli' }),
  ).toBeVisible();
});

test('gli speaker mostrano foto, fallback e collegamenti ai profili', async ({
  page,
}) => {
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  const speakers = page.locator('.session-speakers li');
  await expect(speakers).toHaveCount(2);
  await expect(speakers.locator('.speaker-photo')).toHaveCount(2);
  const externalProfile = page.getByRole('link', { name: 'Emanuele Furlan' });
  await expect(externalProfile).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/emanuele-furlan-6aa9a4225',
  );
  await expect(externalProfile).toHaveAttribute('target', '_blank');
  await expect(externalProfile).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(externalProfile.locator('.visually-hidden')).toHaveText(
    '(si apre in una nuova scheda)',
  );
  await expect(speakers.first().locator('img')).toHaveAttribute('width', '64');
  await expect(speakers.first().locator('img')).toHaveCSS(
    'border-radius',
    '50%',
  );

  await page.goto('/eventi/tech-pub-oqtane-is-not-the-new-dotnetnuke/');
  const internalProfile = page.getByRole('link', { name: 'Mauro Cavallin' });
  await expect(internalProfile).toHaveAttribute(
    'href',
    /\/soci\/mauro-cavallin\/$/,
  );
  await expect(internalProfile).not.toHaveAttribute('target', '_blank');
  await expect(internalProfile).not.toHaveAttribute('rel', /noopener/);
  await expect(internalProfile.locator('.visually-hidden')).toHaveCount(0);
  const alberto = page
    .locator('.speaker-identity')
    .filter({ hasText: 'Alberto Zen' });
  await expect(alberto.locator('.speaker-placeholder')).toHaveText('AZ');
  await expect(alberto.locator('a')).toHaveCount(0);

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});

test('le biografie dei soci sono renderizzate dal Markdown', async ({
  page,
}) => {
  await page.goto('/soci/daniele-morosinotto/');
  await expect(page.locator('.person-profile .prose > p')).toHaveCount(5);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Sono un appassionato di tecnologia/,
  );
  await expect(page.locator('.profile-aside')).toBeVisible();
  await expect(page.locator('.profile-aside-section').first()).toBeVisible();

  await page.goto('/soci/alessandro-calzavara/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Alessandro Calzavara, socio di XeDotNet.',
  );
});

test('l’elenco dei soci raggruppa i profili per iniziale e offre il salto rapido', async ({
  page,
}) => {
  await page.goto('/soci/');
  const letterNav = page.getByRole('navigation', {
    name: 'Salto per iniziale',
  });
  const letters = await letterNav
    .locator('a')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.textContent?.trim() ?? ''),
    );
  expect(letters.length).toBeGreaterThan(2);
  expect(new Set(letters).size).toBe(letters.length);

  const firstLetter = letters[0];
  expect(firstLetter).toBeTruthy();
  const band = page.locator(`#lettera-${firstLetter}`);
  await expect(band).toBeVisible();
  await expect(band.locator('.letter-glyph')).toHaveText(firstLetter ?? '');
  expect(await band.locator('.person-card').count()).toBeGreaterThan(0);
});

test('la mappa dei soci mostra subito la mappa con i pin e mantiene un’alternativa testuale', async ({
  page,
}) => {
  const tileRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('tile.openstreetmap.org')) {
      tileRequests.push(request.url());
    }
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );

  await page.goto('/chi-siamo/');

  const mapSection = page.locator('[data-community-map]');
  await expect(
    mapSection.getByRole('heading', {
      name: 'Il Nord-Est è il nostro punto di partenza',
    }),
  ).toBeVisible();
  await expect(mapSection.locator('.leaflet-container')).toBeVisible();
  await expect(mapSection.locator('.leaflet-marker-icon')).toHaveCount(14);
  await expect(
    mapSection.locator('.leaflet-marker-icon.leaflet-interactive'),
  ).toHaveCount(0);
  await expect(mapSection.locator('.member-map-marker span')).toHaveCount(0);
  await expect(mapSection.locator('.location-list li')).toHaveCount(5);
  await expect(mapSection.locator('.location-list')).toContainText(
    'Treviso e provincia',
  );
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0);
  const firstMarker = mapSection.locator('.leaflet-marker-icon').first();
  await expect(firstMarker).toHaveCSS('margin-left', '-22px');
  await expect(firstMarker).toHaveCSS('margin-top', '-50px');
  expect(
    await firstMarker.evaluate((marker) => getComputedStyle(marker).rotate),
  ).toBe('none');
  expect(
    await firstMarker.evaluate(
      (marker) => getComputedStyle(marker, '::before').rotate,
    ),
  ).toBe('-45deg');
  await expect(
    mapSection.getByRole('link', { name: 'OpenStreetMap' }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('la mappa non causa overflow orizzontale', async ({ page }) => {
  await page.goto('/chi-siamo/');
  await expect(page.locator('[data-map-canvas]')).toBeVisible();
  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});
