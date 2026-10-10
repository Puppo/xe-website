import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const basePath = process.env.E2E_BASE_PATH ?? '';

// Exercise Chrome's implementation, without replacing document.modelContext.
test.use({
  launchOptions: {
    args: ['--enable-features=WebMCP'],
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  },
});

async function nativeNames(page: Page) {
  return page.evaluate(async () =>
    (await document.modelContext?.getTools())?.map((tool) => tool.name),
  );
}

async function executeNative(
  page: Page,
  name: string,
  input: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ name: toolName, input: argumentsInput }) => {
      const context = document.modelContext;
      const tool = (await context?.getTools())?.find(
        (item) => item.name === toolName,
      );
      if (!context || !tool)
        throw new Error(`Strumento nativo mancante: ${toolName}`);
      return context.executeTool(tool, argumentsInput);
    },
    { name, input },
  );
}

async function navigateNative(
  page: Page,
  name: string,
  slug: string,
  path: string,
) {
  await Promise.all([
    page.waitForURL(
      (url) =>
        url.origin === 'http://127.0.0.1:4325' &&
        url.pathname === `${basePath}${path}`,
    ),
    executeNative(page, name, { slug }).catch((error: unknown) => {
      // The caller is inside the document that the tool replaces. Require the
      // Destination above, but allow its evaluation context to be destroyed.
      if (
        !(error instanceof Error) ||
        !error.message.includes('Execution context was destroyed')
      )
        throw error;
    }),
  ]);
}

test('Chrome scopre ed esegue gli strumenti nativi nelle diverse pagine', async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('[WebMCP]')) warnings.push(message.text());
  });
  for (const route of [
    '/',
    '/contatti/',
    '/eventi/tech-pub-gennaio-2025/',
    '/soci/emanuele-furlan/',
  ]) {
    await page.goto(`${basePath}${route}`);
    await expect
      .poll(() => nativeNames(page))
      .toEqual(
        expect.arrayContaining([
          'list_events',
          'get_event',
          'list_members',
          'get_member',
          'search_event_materials',
        ]),
      );
    const names = await nativeNames(page);
    expect(new Set(names).size).toBe(names?.length);
    const profile = await executeNative(page, 'get_member', {
      slug: 'emanuele-furlan',
    });
    expect(profile.length).toBeLessThanOrEqual(1500);
    expect(JSON.parse(profile)).toMatchObject({ name: 'Emanuele Furlan' });
    const materials = await executeNative(page, 'search_event_materials', {});
    expect(materials.length).toBeLessThanOrEqual(1500);
    expect(JSON.parse(materials).materials.length).toBeGreaterThan(0);
    const missing = await executeNative(page, 'get_member', {
      slug: 'inesistente',
    });
    expect(JSON.parse(missing)).toMatchObject({
      code: 'INVALID_INPUT',
      retryable: false,
    });
  }
  expect(warnings).toEqual([]);
});

test('la cronologia ripristina la scoperta nativa senza duplicati', async ({
  page,
}) => {
  await page.goto(`${basePath}/`);
  await expect.poll(() => nativeNames(page)).toContain('get_member');
  const initial = await nativeNames(page);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  );
  await expect.poll(() => nativeNames(page)).toEqual([]);
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
  });
  await expect.poll(() => nativeNames(page)).toEqual(initial);
  await page.goto(`${basePath}/contatti/`);
  await page.goBack();
  await expect.poll(() => nativeNames(page)).toEqual(initial);
  expect(
    JSON.parse(
      await executeNative(page, 'list_members', { query: 'Emanuele Furlan' }),
    ).members,
  ).toHaveLength(1);
  // Chrome may evict the document; either restoration path must remain usable.
  await page.goForward();
  await expect.poll(() => nativeNames(page)).toContain('get_member');
});

test('la navigazione nativa rimane nell’origine e nel percorso di base attivi', async ({
  page,
}) => {
  await page.goto(`${basePath}/`);
  await expect.poll(() => nativeNames(page)).toContain('open_member');
  await navigateNative(
    page,
    'open_member',
    'emanuele-furlan',
    '/soci/emanuele-furlan/',
  );
  await expect.poll(() => nativeNames(page)).toContain('open_event');
  await navigateNative(
    page,
    'open_event',
    'tech-pub-gennaio-2025',
    '/eventi/tech-pub-gennaio-2025/',
  );
});
