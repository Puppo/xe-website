import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The same assertions also exercise a locally served GitHub Pages subpath build.
const base = process.env.E2E_BASE_PATH ?? '';

test('i materiali di App modernization compaiono una volta sotto il talk corretto', async ({
  page,
  request,
}) => {
  await page.goto(`${base}/eventi/one-day-app-modernization/`);
  const sessions = page.locator('.agenda .session'),
    links = sessions.locator('.session-materials a');
  await expect(sessions).toHaveCount(15);
  await expect(links).toHaveCount(12);
  await expect(
    page.getByRole('heading', { name: 'Materiali', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.prose')).not.toContainText(
    'Slide e codice sessioni',
  );
  const blazor = sessions.filter({
    has: page.getByRole('heading', {
      name: 'Blazor United. Un salto nel futuro',
      exact: true,
    }),
  });
  await expect(blazor.locator('.session-materials a')).toHaveCount(2);
  await expect(
    blazor.getByRole('link', { name: /^Codice — Blazor United/u }),
  ).toHaveAttribute('href', 'https://github.com/andreadottor/BrewerApp');
  const davide = sessions.filter({
    has: page.getByRole('heading', {
      name: 'Modernize your community',
      exact: true,
    }),
  });
  await expect(davide.locator('.session-materials')).toHaveCount(0);
  for (const link of await links.all()) {
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAccessibleName(
      / — .+ \(si apre in una nuova scheda\)/u,
    );
  }
  const first = links.first();
  await first.focus();
  await expect(first).toBeFocused();
  expect(
    await first.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe('solid');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A');
  const response = await request.get(
      `${base}/webmcp/events/one-day-app-modernization.json`,
    ),
    details = await response.json();
  expect(details.materials).toHaveLength(12);
  expect(
    details.sessions.flatMap(
      (session: { materials: unknown[] }) => session.materials,
    ),
  ).toHaveLength(12);
});

test('slide comuni e codice dei singoli talk rimangono distinti e accessibili', async ({
  page,
}) => {
  for (const slug of [
    'net-maui',
    'blazorconf2026',
    'one-day-app-modernization',
    'one-day-rethink-application',
    'lab-git-e-github',
  ]) {
    await page.goto(`${base}/eventi/${slug}/`);
    if (slug === 'net-maui') {
      await expect(page.locator('.session-materials a')).toHaveCount(2);
      const shared = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'Materiali', exact: true }),
      });
      await expect(shared.locator('a')).toHaveCount(1);
    }
    if (slug === 'blazorconf2026') {
      await expect(page.locator('.session-materials a')).toHaveCount(8);
      await expect(page.locator('.prose')).not.toContainText(
        'Disponibile il materiale',
      );
    }
    if (slug === 'one-day-rethink-application') {
      await expect(page.locator('.session-materials')).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'Materiali', exact: true }),
      ).toHaveCount(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations, slug).toEqual([]);
  }
});
