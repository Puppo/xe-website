import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWebMcpJson,
  registerWebMcpTools,
} from '../src/lib/webmcp-runtime';

afterEach(() => vi.unstubAllGlobals());

describe('esecuzione e ciclo di vita WebMCP', () => {
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

  it('restituisce errori utilizzabili e conserva l’annullamento nativo', async () => {
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

  it('ripristina gli strumenti una sola volta dopo il ritorno dalla cache', async () => {
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

  it('limita anche le risposte di strumenti registrati direttamente', async () => {
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

  it('mantiene entro il limite anche messaggi di errore con escape lunghi', async () => {
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

  it('segnala errori di registrazione senza includere argomenti o dati personali', async () => {
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

describe('caricamento JSON annullabile', () => {
  const isString = (value: unknown): value is string =>
    typeof value === 'string';

  it('dà precedenza all’annullamento anche quando arriva un errore HTTP', async () => {
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

  it('non memorizza errori e riusa solo risposte valide', async () => {
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

  it('annulla una richiesta senza interrompere un’altra invocazione', async () => {
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
