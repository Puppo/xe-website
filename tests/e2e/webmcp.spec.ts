import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface RegisteredTool {
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  description: string;
  inputSchema: {
    properties?: Record<string, { description?: string; pattern?: string }>;
  };
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
        registerTool(tool: unknown, { signal }: { signal: AbortSignal }) {
          tools.push(tool);
          signal.addEventListener('abort', () => {
            const index = tools.indexOf(tool);
            if (index !== -1) tools.splice(index, 1);
          });
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

async function invokeTool(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
) {
  await waitForTool(page, name);
  return page.evaluate(
    async ({ name: toolName, input: argumentsInput }) => {
      const tool = (
        window as unknown as { webMcpTools: RegisteredTool[] }
      ).webMcpTools.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Missing tool: ${toolName}`);
      return tool.execute(argumentsInput, {
        signal: new AbortController().signal,
      });
    },
    { name, input },
  );
}

test('catalog tools search and open events', async ({ page }) => {
  const catalogRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/webmcp/events.json')) {
      catalogRequests.push(request.url());
    }
  });
  await mockWebMcp(page);
  await page.goto('/eventi/');
  await waitForTool(page, 'list_events');
  await waitForTool(page, 'open_event');
  await waitForTool(page, 'prepare_newsletter_subscription');
  expect(catalogRequests).toEqual([]);

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
  expect(catalogRequests).toHaveLength(1);

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

test('event pages expose a compact description', async ({ page }) => {
  const detailRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/webmcp/events/tech-pub-gennaio-2025.json')) {
      detailRequests.push(request.url());
    }
  });
  await mockWebMcp(page);
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  await waitForTool(page, 'describe_event');
  expect(detailRequests).toEqual([]);

  const description = await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find((candidate) => candidate.name === 'describe_event');
    return tool?.execute({}, { signal: new AbortController().signal });
  });
  expect(description).toContain('Tech-Pub: gennaio 2025');
  expect(description).toContain('Emanuele Furlan');
  expect(String(description).length).toBeLessThanOrEqual(1500);
  expect(detailRequests).toHaveLength(1);
});

test('newsletter preparation fills the form without submitting', async ({
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

test('contact preparation is available only with a configured form and does not submit', async ({
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

test('member catalog tools search and open profiles', async ({ page }) => {
  await mockWebMcp(page);
  await page.goto('/soci/');
  await waitForTool(page, 'list_members');
  await waitForTool(page, 'open_member');

  const result = await page.evaluate(() => {
    const tools = (window as unknown as { webMcpTools: RegisteredTool[] })
        .webMcpTools,
      tool = tools.find((candidate) => candidate.name === 'list_members');
    return tool?.execute(
      { role: 'speaker' },
      { signal: new AbortController().signal },
    );
  });
  expect(result).toMatchObject({ offset: 0 });
  expect((result as { members: unknown[] }).members.length).toBeGreaterThan(0);

  const target = ((result as { members: { slug: string; url: string }[] })
    .members[0] ?? {}) as { slug: string; url: string };

  await Promise.all([
    page.waitForURL(new RegExp(`/soci/${target.slug}/$`)),
    page.evaluate((slug) => {
      const tool = (
        window as unknown as { webMcpTools: RegisteredTool[] }
      ).webMcpTools.find((candidate) => candidate.name === 'open_member');
      return tool?.execute({ slug }, { signal: new AbortController().signal });
    }, target.slug),
  ]);
});

test('member pages expose a compact description', async ({ page }) => {
  const detailRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/webmcp/members/emanuele-furlan.json')) {
      detailRequests.push(request.url());
    }
  });
  await mockWebMcp(page);
  await page.goto('/soci/emanuele-furlan/');
  await waitForTool(page, 'describe_member');
  expect(detailRequests).toEqual([]);

  const description = await page.evaluate(() => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find((candidate) => candidate.name === 'describe_member');
    return tool?.execute({}, { signal: new AbortController().signal });
  });
  expect(description).toContain('Emanuele Furlan');
  expect(description).toContain('socio e relatore');
  expect(String(description).length).toBeLessThanOrEqual(1500);
  expect(detailRequests).toHaveLength(1);
});

test('a WebMCP network error can be retried', async ({ page }) => {
  let requests = 0;
  await page.route('**/webmcp/events.json', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, body: 'temporarily unavailable' });
      return;
    }
    await route.continue();
  });
  await mockWebMcp(page);
  await page.goto('/eventi/');
  await waitForTool(page, 'list_events');

  const invoke = () =>
    page.evaluate(async () => {
      const tool = (
        window as unknown as { webMcpTools: RegisteredTool[] }
      ).webMcpTools.find((candidate) => candidate.name === 'list_events');
      return tool?.execute({}, { signal: new AbortController().signal });
    });
  expect(await invoke()).toMatchObject({
    code: 'DATA_UNAVAILABLE',
    retryable: true,
  });
  expect(await invoke()).toMatchObject({ offset: 0 });
  expect(requests).toBe(2);
});

test('home registers exactly one member catalog', async ({ page }) => {
  await mockWebMcp(page);
  await page.goto('/');
  await waitForTool(page, 'list_members');
  await waitForTool(page, 'open_member');
  await waitForTool(page, 'prepare_newsletter_subscription');
});

test('event pages can open speaker profiles', async ({ page }) => {
  await mockWebMcp(page);
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  await waitForTool(page, 'list_members');

  await Promise.all([
    page.waitForURL(/\/soci\/emanuele-furlan\/$/u),
    page.evaluate(() => {
      const tool = (
        window as unknown as { webMcpTools: RegisteredTool[] }
      ).webMcpTools.find((candidate) => candidate.name === 'open_member');
      return tool?.execute(
        { slug: 'emanuele-furlan' },
        { signal: new AbortController().signal },
      );
    }),
  ]);
});

test('opening a member does not navigate when loading is cancelled', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/soci/');
  await waitForTool(page, 'open_member');
  const originalUrl = page.url();

  await page.route('**/webmcp/members.json', async (route) => {
    await page.evaluate(() => {
      (
        window as unknown as { memberInvocation: AbortController }
      ).memberInvocation.abort();
    });
    await route.abort('aborted');
  });

  const result = await page.evaluate(async () => {
    const controller = new AbortController();
    (
      window as unknown as { memberInvocation: AbortController }
    ).memberInvocation = controller;
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find((candidate) => candidate.name === 'open_member');
    if (!tool) {
      throw new Error('The open_member tool is unavailable.');
    }
    try {
      await tool.execute(
        { slug: 'emanuele-furlan' },
        { signal: controller.signal },
      );
      return 'ok';
    } catch (error) {
      return error instanceof DOMException ? error.name : 'error';
    }
  });

  expect(result).toBe('AbortError');
  expect(page.url()).toBe(originalUrl);
});

test('all events and details are available from every page', async ({
  page,
}) => {
  await mockWebMcp(page);

  for (const path of [
    '/',
    '/soci/',
    '/soci/emanuele-furlan/',
    '/contatti/',
    '/chi-siamo/',
    '/privacy-policy/',
    '/grazie/',
    '/eventi/tech-pub-gennaio-2025/',
    '/404.html',
  ]) {
    await page.goto(path);
    await waitForTool(page, 'list_events');
    await waitForTool(page, 'get_event');

    const result = await page.evaluate(async () => {
      const tools = (window as unknown as { webMcpTools: RegisteredTool[] })
        .webMcpTools;
      const list = tools.find((candidate) => candidate.name === 'list_events');
      const details = tools.find((candidate) => candidate.name === 'get_event');
      const past = await list?.execute(
        {
          dateFrom: '2025-01-01',
          dateTo: '2025-01-31',
          speakers: ['Emanuele Furlan'],
        },
        { signal: new AbortController().signal },
      );
      const event = await details?.execute(
        { slug: 'tech-pub-gennaio-2025' },
        { signal: new AbortController().signal },
      );
      const body = await details?.execute(
        { slug: 'tech-pub-gennaio-2025', section: 'body' },
        { signal: new AbortController().signal },
      );
      const sessions = await details?.execute(
        { slug: 'tech-pub-gennaio-2025', section: 'sessions' },
        { signal: new AbortController().signal },
      );
      return {
        body: body as { text: string },
        sessions: sessions as { sessions: { speakers: string[] }[] },
        past: past as { total: number; events: { slug: string }[] },
        event: event as {
          title: string;
          body: string;
          sessions: { speakers: string[] }[];
        },
      };
    });

    expect(result.past.events.map((event) => event.slug)).toContain(
      'tech-pub-gennaio-2025',
    );
    expect(result.event.title).toContain('Tech-Pub');
    expect(
      result.sessions.sessions.flatMap((session) => session.speakers),
    ).toContain('Emanuele Furlan');
    expect(result.body.text.length).toBeGreaterThan(0);
  }
});

test('pages work without WebMCP support', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tech-Pub: gennaio 2025',
  );
  expect(errors).toEqual([]);
});

test('newsletter preparation rejects invalid email without submitting', async ({
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

  const errorMessage = await page.evaluate(async () => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find(
      (candidate) => candidate.name === 'prepare_newsletter_subscription',
    );
    const result = await tool?.execute(
      { email: 'not-an-email' },
      { signal: new AbortController().signal },
    );
    return (result as { error: string }).error;
  });
  expect(errorMessage).toMatch(/email/i);

  await expect(page.locator('#newsletter-email')).toHaveValue('');
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { newsletterSubmits: number }).newsletterSubmits,
    ),
  ).toBe(0);
});

test('contact preparation rejects invalid data without submitting', async ({
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

  const errorMessage = await page.evaluate(async () => {
    const tool = (
      window as unknown as { webMcpTools: RegisteredTool[] }
    ).webMcpTools.find(
      (candidate) => candidate.name === 'prepare_contact_message',
    );
    const result = await tool?.execute(
      { email: 'bad', message: 'ok', name: '' },
      { signal: new AbortController().signal },
    );
    return (result as { error: string }).error;
  });
  expect(errorMessage).toMatch(/name|email/i);

  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#privacy')).not.toBeChecked();
  expect(
    await page.evaluate(
      () => (window as unknown as { contactSubmits: number }).contactSubmits,
    ),
  ).toBe(0);
});

test('profiles and materials are available sitewide without navigation', async ({
  page,
}) => {
  await mockWebMcp(page);
  for (const path of ['/contatti/', '/chi-siamo/', '/privacy-policy/']) {
    await page.goto(path);
    const originalUrl = page.url();
    const members = (await invokeTool(page, 'list_members', {
      query: 'Emanuele Furlan',
    })) as { members: { slug: string }[] };
    expect(members.members.map(({ slug }) => slug)).toContain(
      'emanuele-furlan',
    );
    const profile = await invokeTool(page, 'get_member', {
      slug: 'emanuele-furlan',
    });
    expect(profile).toMatchObject({
      name: 'Emanuele Furlan',
      roles: expect.arrayContaining(['member']),
    });
    const links = await invokeTool(page, 'get_member', {
      slug: 'emanuele-furlan',
      section: 'links',
    });
    expect(links).toHaveProperty('links');
    const materials = (await invokeTool(page, 'search_event_materials', {
      eventSlug: 'one-day-app-modernization',
    })) as { materials: { url: string; sessions: string[] }[]; total: number };
    expect(materials.total).toBe(12);
    expect(materials.materials.length).toBeGreaterThan(0);
    expect(materials.materials.every((item) => item.sessions.length > 0)).toBe(
      true,
    );
    for (const value of [members, profile, links, materials])
      expect(JSON.stringify(value).length).toBeLessThanOrEqual(1500);
    expect(page.url()).toBe(originalUrl);
    const names = await toolNames(page);
    expect(new Set(names).size).toBe(names.length);
  }
});

test('metadata distinguishes queries, navigation and preparation', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/eventi/tech-pub-gennaio-2025/');
  await waitForTool(page, 'describe_event');
  const tools = await page.evaluate(() =>
    (window as unknown as { webMcpTools: RegisteredTool[] }).webMcpTools.map(
      ({ name, annotations, description, inputSchema }) => ({
        name,
        annotations,
        description,
        inputSchema,
      }),
    ),
  );
  for (const tool of tools) {
    expect(tool.description.length).toBeLessThanOrEqual(500);
    if (tool.name.startsWith('open_') || tool.name.startsWith('prepare_')) {
      expect(tool.annotations?.readOnlyHint).toBeUndefined();
    } else {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        untrustedContentHint: true,
      });
    }
    for (const property of Object.values(tool.inputSchema.properties ?? {})) {
      expect(property.description?.length ?? 0).toBeLessThanOrEqual(150);
      if (property.pattern)
        expect(new RegExp(property.pattern, 'u').test('2026-10-10')).toBe(true);
    }
  }
});

test('a newsletter draft is preserved and blocks navigation', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/');
  await page.locator('#newsletter-email').fill('bozza@example.com');
  expect(
    await invokeTool(page, 'prepare_newsletter_subscription', {
      email: 'altro@example.com',
    }),
  ).toMatchObject({ code: 'DRAFT_CONFLICT' });
  await expect(page.locator('#newsletter-email')).toHaveValue(
    'bozza@example.com',
  );
  for (const [name, slug] of [
    ['open_event', 'tech-pub-gennaio-2025'],
    ['open_member', 'emanuele-furlan'],
  ]) {
    expect(await invokeTool(page, name, { slug })).toMatchObject({
      code: 'UNSAVED_CHANGES',
    });
    expect(new URL(page.url()).pathname).toBe('/');
  }
  expect(
    await invokeTool(page, 'prepare_newsletter_subscription', {
      email: 'bozza@example.com',
    }),
  ).toMatchObject({ status: 'requires_user_action' });
});

test('validation failures preserve all fields and consent', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/contatti/');
  if ((await page.locator('[data-contact-form]').count()) === 0) return;
  await page.locator('#name').fill('Bozza');
  await page.locator('#message').fill('Messaggio già scritto.');
  await page.locator('#privacy').check();
  const result = await invokeTool(page, 'prepare_contact_message', {
    name: 'Nome diverso',
    email: 'valido@example.com',
    message: 'x'.repeat(5001),
  });
  // A draft conflict or length validation both leave the complete draft unchanged.
  expect(result).toHaveProperty('error');
  await expect(page.locator('#name')).toHaveValue('Bozza');
  await expect(page.locator('#email')).toHaveValue('');
  await expect(page.locator('#message')).toHaveValue('Messaggio già scritto.');
  await expect(page.locator('#privacy')).toBeChecked();
});

test('returning from pagehide restores all tools exactly once', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/');
  await waitForTool(page, 'get_member');
  await waitForTool(page, 'prepare_newsletter_subscription');
  const before = (await toolNames(page)).sort();
  const restored = await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    );
    const tools = (window as unknown as { webMcpTools: RegisteredTool[] })
      .webMcpTools;
    const hiddenCount = tools.length;
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    return { hiddenCount, names: tools.map((tool) => tool.name).sort() };
  });
  expect(restored.hiddenCount).toBe(0);
  expect(restored.names).toEqual(before);
  expect(await invokeTool(page, 'list_members')).toHaveProperty('members');
});

test('loading a malformed catalog returns a structured error', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.route('**/webmcp/events.json', (route) =>
    route.fulfill({ json: [{}] }),
  );
  await page.goto('/');
  expect(await invokeTool(page, 'list_events')).toMatchObject({
    code: 'INVALID_DATA',
    retryable: false,
  });
});

test('contact preparation rejects exceeded limits before changing fields', async ({
  page,
}) => {
  await mockWebMcp(page);
  await page.goto('/contatti/');
  if ((await page.locator('[data-contact-form]').count()) === 0) return;
  expect(
    await invokeTool(page, 'prepare_contact_message', {
      name: 'Persona',
      email: 'persona@example.com',
      message: 'x'.repeat(5001),
    }),
  ).toMatchObject({ code: 'INVALID_INPUT' });
  for (const selector of ['#name', '#email', '#message'])
    await expect(page.locator(selector)).toHaveValue('');
  await page.locator('#privacy').check();
  expect(
    await invokeTool(page, 'prepare_contact_message', {
      name: 'Persona',
      email: 'persona@example.com',
      message: 'Un messaggio valido.',
    }),
  ).toMatchObject({ status: 'requires_user_action' });
  await expect(page.locator('#privacy')).toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Invia il messaggio' }),
  ).toBeFocused();
});
