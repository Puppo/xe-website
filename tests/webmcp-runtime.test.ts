import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWebMcpJson,
  registerWebMcpTools,
} from '../src/lib/webmcp-runtime';

afterEach(() => vi.unstubAllGlobals());

describe('WebMCP execution and lifecycle', () => {
  function setup() {
    const window = new EventTarget();
    const active = new Map<string, WebMCP.ModelContextTool>();
    const registerTool = vi.fn(
      (tool: WebMCP.ModelContextTool, options: { signal: AbortSignal }) => {
        if (active.has(tool.name))
          return Promise.reject(new Error('Duplicato'));
        active.set(tool.name, tool);
        options.signal.addEventListener('abort', () =>
          active.delete(tool.name),
        );
        return Promise.resolve();
      },
    );
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', { modelContext: { registerTool } });
    return { window, active, registerTool };
  }

  it('returns actionable errors and preserves native cancellation', async () => {
    const { active } = setup();
    registerWebMcpTools([
      {
        name: 'test',
        description: 'Prova',
        execute() {
          throw new TypeError('Indica uno slug valido.');
        },
      },
    ]);
    const tool = active.get('test');
    expect(
      await tool?.execute({}, { signal: new AbortController().signal }),
    ).toMatchObject({
      code: 'INVALID_INPUT',
      error: 'Indica uno slug valido.',
      retryable: false,
    });
    const controller = new AbortController();
    controller.abort('annullato');
    await expect(tool?.execute({}, { signal: controller.signal })).rejects.toBe(
      'annullato',
    );
  });

  it('restores tools exactly once after returning from the cache', async () => {
    const { window, active, registerTool } = setup();
    registerWebMcpTools([
      { name: 'test', description: 'Prova', execute: () => 'ok' },
    ]);
    expect(active.size).toBe(1);
    window.dispatchEvent(new Event('pagehide'));
    expect(active.size).toBe(0);
    const pageshow = new Event('pageshow');
    Object.defineProperty(pageshow, 'persisted', { value: true });
    window.dispatchEvent(pageshow);
    window.dispatchEvent(pageshow);
    await Promise.resolve();
    expect(active.size).toBe(1);
    expect(registerTool).toHaveBeenCalledTimes(2);
  });

  it('also bounds responses from directly registered tools', async () => {
    const { active } = setup();
    registerWebMcpTools([
      { name: 'test', description: 'Prova', execute: () => 'x'.repeat(2000) },
    ]);
    expect(
      await active
        .get('test')
        ?.execute({}, { signal: new AbortController().signal }),
    ).toMatchObject({ code: 'OUTPUT_TOO_LARGE' });
  });

  it('bounds error messages with long escaped text', async () => {
    const { active } = setup();
    registerWebMcpTools([
      {
        name: 'test',
        description: 'Prova',
        execute() {
          throw new TypeError('\u0000'.repeat(1000));
        },
      },
    ]);
    const result = await active
      .get('test')
      ?.execute({}, { signal: new AbortController().signal });
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
    expect(result).toMatchObject({ retryable: false });
  });

  it('reports registration errors without arguments or personal data', async () => {
    const { registerTool } = setup();
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    registerTool.mockRejectedValueOnce(
      new DOMException('Dettaglio privato', 'NotAllowedError'),
    );
    registerWebMcpTools([
      { name: 'test', description: 'Prova', execute: () => 'ok' },
    ]);
    await Promise.resolve();
    expect(warning).toHaveBeenCalledWith('[WebMCP]', 'test', 'NotAllowedError');
    warning.mockRestore();
  });
});

describe('abortable JSON loading', () => {
  const isString = (value: unknown): value is string =>
    typeof value === 'string';

  it('prioritizes cancellation even when an HTTP error arrives', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        controller.abort('annullato');
        return Promise.resolve(new Response('', { status: 503 }));
      }),
    );
    await expect(
      fetchWebMcpJson('/cancelled-response', isString, controller.signal),
    ).rejects.toBe('annullato');
  });

  it('does not cache failures and reuses only valid responses', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json('dati'));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchWebMcpJson('/retry', isString)).rejects.toThrow(
      /disponibili/iu,
    );
    expect(await fetchWebMcpJson('/retry', isString)).toBe('dati');
    expect(await fetchWebMcpJson('/retry', isString)).toBe('dati');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts one request without interrupting another invocation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }: { signal?: AbortSignal }) =>
          new Promise<Response>((resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason));
            if (!signal) resolve(Response.json('dati'));
          }),
      ),
    );
    const controller = new AbortController();
    const cancelled = fetchWebMcpJson(
      '/concurrent',
      isString,
      controller.signal,
    );
    const independent = fetchWebMcpJson('/concurrent', isString);
    controller.abort('stop');
    await expect(cancelled).rejects.toBe('stop');
    expect(await independent).toBe('dati');
  });
});
