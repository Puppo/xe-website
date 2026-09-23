import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface RegisteredTool {
  annotations?: { readOnlyHint?: boolean };
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ) => unknown;
  name: string;
}

async function mockWebMcp(page: Page) {
  await page.addInitScript(() => {
    const tools: unknown[] = [],
      context = {
        registerTool(tool: unknown) {
          tools.push(tool);
          return Promise.resolve();
        },
      };
    Object.defineProperty(window, 'webMcpTools', { value: tools });
    Object.defineProperty(Document.prototype, 'modelContext', {
      configurable: true,
      get: () => context,
    });
  });
}

async function toolNames(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { webMcpTools: RegisteredTool[] }
        ).webMcpTools.map((tool) => tool.name),
      ),
    )
    .not.toEqual([]);
  return page.evaluate(() =>
    (window as unknown as { webMcpTools: RegisteredTool[] }).webMcpTools.map(
      (tool) => tool.name,
    ),
  );
}

async function waitForTool(page: Page, name: string) {
  await expect
    .poll(async () => (await toolNames(page)).includes(name))
    .toBe(true);
}

test('gli strumenti catalogo cercano e aprono gli eventi', async ({ page }) => {
  await mockWebMcp(page);
  await page.goto('/eventi/');
  await waitForTool(page, 'list_events');
  await waitForTool(page, 'open_event');
  await waitForTool(page, 'prepare_newsletter_subscription');

  const result = await page.evaluate(() => {
    const tools = (window as unknown as { webMcpTools: RegisteredTool[] })
        .webMcpTools,
      tool = tools.find((candidate) => candidate.name === 'list_events');
    return tool?.execute(
      { query: 'Tech-Pub' },
      { signal: new AbortController().signal },
    );
  });
  expect(result).toMatchObject({ offset: 0 });
  expect((result as { events: unknown[] }).events.length).toBeGreaterThan(0);

  await Promise.all([
    page.waitForURL(/\/eventi\/tech-pub-gennaio-2025\/$/u),
    page.evaluate(() => {
      const tool = (
        window as unknown as { webMcpTools: RegisteredTool[] }
      ).webMcpTools.find((candidate) => candidate.name === 'open_event');
      return tool?.execute(
        { slug: 'tech-pub-gennaio-2025' },
        { signal: new AbortController().signal },
      );
    }),
  ]);
});

test('la pagina evento espone una descrizione compatta', async ({ page }) => {
  await mockWebMcp(page);
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  await waitForTool(page, 'describe_event');

  const description = await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find((candidate) => candidate.name === 'describe_event');
    return tool?.execute({}, { signal: new AbortController().signal });
  });
  expect(description).toContain('Tech-Pub: gennaio 2025');
  expect(description).toContain('Emanuele Furlan');
  expect(String(description).length).toBeLessThanOrEqual(1500);
});

test('la newsletter viene compilata ma non inviata', async ({ page }) => {
  await mockWebMcp(page);
  await page.goto('/');
  await waitForTool(page, 'prepare_newsletter_subscription');
  await page.locator('[data-newsletter-form]').evaluate((form) => {
    Object.defineProperty(window, 'newsletterSubmits', {
      configurable: true,
      value: 0,
      writable: true,
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      (window as unknown as { newsletterSubmits: number }).newsletterSubmits +=
        1;
    });
  });

  await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find(
      (candidate) => candidate.name === 'prepare_newsletter_subscription',
    );
    return tool?.execute(
      { email: 'persona@example.com' },
      { signal: new AbortController().signal },
    );
  });

  await expect(page.locator('#newsletter-email')).toHaveValue(
    'persona@example.com',
  );
  await expect(page.getByRole('button', { name: 'Iscriviti' })).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { newsletterSubmits: number }).newsletterSubmits,
    ),
  ).toBe(0);
});

test('il contatto è disponibile solo con il modulo configurato e non viene inviato', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/contatti/');
  const hasContactForm =
      (await page.locator('[data-contact-form]').count()) > 0,
    names = await toolNames(page);

  if (!hasContactForm) {
    expect(names).not.toContain('prepare_contact_message');
    return;
  }

  expect(names).toContain('prepare_contact_message');
  await page.locator('[data-contact-form]').evaluate((form) => {
    Object.defineProperty(window, 'contactSubmits', {
      configurable: true,
      value: 0,
      writable: true,
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      (window as unknown as { contactSubmits: number }).contactSubmits += 1;
    });
  });
  await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find(
      (candidate) => candidate.name === 'prepare_contact_message',
    );
    return tool?.execute(
      {
        email: 'persona@example.com',
        message: 'Vorrei proporre un incontro.',
        name: 'Persona Test',
      },
      { signal: new AbortController().signal },
    );
  });

  await expect(page.locator('#name')).toHaveValue('Persona Test');
  await expect(page.locator('#email')).toHaveValue('persona@example.com');
  await expect(page.locator('#message')).toHaveValue(
    'Vorrei proporre un incontro.',
  );
  await expect(page.locator('#privacy')).not.toBeChecked();
  await expect(page.locator('#privacy')).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as unknown as { contactSubmits: number }).contactSubmits,
    ),
  ).toBe(0);
});

test('le pagine funzionano senza supporto WebMCP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tech-Pub: gennaio 2025',
  );
  expect(errors).toEqual([]);
});

test('la newsletter rifiuta email non valide senza inviare il modulo', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/');
  await waitForTool(page, 'prepare_newsletter_subscription');
  await page.locator('[data-newsletter-form]').evaluate((form) => {
    Object.defineProperty(window, 'newsletterSubmits', {
      configurable: true,
      value: 0,
      writable: true,
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      (window as unknown as { newsletterSubmits: number }).newsletterSubmits +=
        1;
    });
  });

  const error = await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find(
      (candidate) => candidate.name === 'prepare_newsletter_subscription',
    );
    try {
      tool?.execute(
        { email: 'not-an-email' },
        { signal: new AbortController().signal },
      );
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause);
    }
  });
  expect(error).toMatch(/email/i);

  await expect(page.locator('#newsletter-email')).toHaveValue('not-an-email');
  await expect(page.locator('#newsletter-email')).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { newsletterSubmits: number }).newsletterSubmits,
    ),
  ).toBe(0);
});

test('il contatto rifiuta dati non validi senza inviare il modulo', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/contatti/');
  const hasContactForm =
    (await page.locator('[data-contact-form]').count()) > 0;
  if (!hasContactForm) {
    test.skip(true, 'PUBLIC_CONTACT_FORM_ACTION non configurato');
    return;
  }
  await waitForTool(page, 'prepare_contact_message');
  await page.locator('[data-contact-form]').evaluate((form) => {
    Object.defineProperty(window, 'contactSubmits', {
      configurable: true,
      value: 0,
      writable: true,
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      (window as unknown as { contactSubmits: number }).contactSubmits += 1;
    });
  });

  const error = await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find(
      (candidate) => candidate.name === 'prepare_contact_message',
    );
    try {
      tool?.execute(
        { email: 'bad', message: 'ok', name: '' },
        { signal: new AbortController().signal },
      );
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause);
    }
  });
  expect(error).toMatch(/name|email/i);

  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#privacy')).not.toBeChecked();
  expect(
    await page.evaluate(
      () => (window as unknown as { contactSubmits: number }).contactSubmits,
    ),
  ).toBe(0);
});
