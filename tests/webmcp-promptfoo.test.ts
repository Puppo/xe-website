import { describe, expect, it, vi } from 'vitest';
import WebMcpOllamaProvider from '../scripts/webmcp-promptfoo-provider.mjs';
import { assertTrajectory } from '../scripts/lib/webmcp-promptfoo-assertion.mjs';

const tools = ['list_members', 'get_member'].map((name) => ({
  type: 'function',
  function: { name, description: name, parameters: { type: 'object' } },
}));
const config = {
  base: 'http://localhost:11434',
  model: 'qwen3:4b',
  tools,
  maxSteps: 4,
  requestTimeoutMs: 50,
  generationTokens: 1024,
  contextTokens: 8192,
  think: false,
};
const messages = [
  {
    role: 'user',
    type: 'message',
    content: 'Trova Ada e leggi il suo profilo.',
  },
];
const expectedCall = [
  {
    functionName: 'list_members',
    arguments: { query: 'Ada' },
    mockOutput: { members: [{ slug: 'ada' }] },
  },
  {
    functionName: 'get_member',
    arguments: { slug: 'ada' },
    mockOutput: { name: 'Ada', biography: 'Biografia.' },
  },
];
const context = { vars: { expectedCall: JSON.stringify(expectedCall) } };
const completion = (name?: string, args = {}) =>
  new Response(
    JSON.stringify({
      done: true,
      done_reason: 'stop',
      prompt_eval_count: 10,
      eval_count: 5,
      message: {
        role: 'assistant',
        content: name ? '' : 'Ada: Biografia.',
        ...(name
          ? { tool_calls: [{ function: { name, arguments: args } }] }
          : {}),
      },
    }),
  );

describe('conversazioni Promptfoo con Ollama', () => {
  it('esegue la catena completa e restituisce i risultati simulati al modello', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(completion('list_members', { query: 'Ada' }))
      .mockResolvedValueOnce(completion('get_member', { slug: 'ada' }))
      .mockResolvedValueOnce(completion());
    const provider = new WebMcpOllamaProvider({ config }, fetcher);
    const response = await provider.callApi(JSON.stringify(messages), context);
    expect(
      assertTrajectory(response.output, {
        ...context,
        providerResponse: response,
      }).pass,
    ).toBe(true);
    const secondRequest = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(secondRequest.messages.at(-1)).toMatchObject({
      role: 'tool',
      content: JSON.stringify(expectedCall[0].mockOutput),
    });
    expect(secondRequest.tools).toEqual(tools);
    expect(secondRequest.think).toBe(false);
    expect(secondRequest.options).toMatchObject({
      num_ctx: 8192,
      num_predict: 1024,
    });
    expect(secondRequest.messages[0].content).not.toContain('list_members');
    expect(response.tokenUsage).toMatchObject({
      prompt: 30,
      completion: 15,
      total: 45,
    });
  });

  it('preserva i risultati strutturati della conversazione precedente', async () => {
    const history = [
      ...messages,
      {
        role: 'model',
        type: 'functioncall',
        name: 'get_member',
        arguments: { slug: 'ada', section: 'biography' },
      },
      {
        role: 'user',
        type: 'functionresponse',
        name: 'get_member',
        response: { result: { text: 'Prima parte.', nextOffset: 12 } },
      },
    ];
    const fetcher = vi.fn().mockResolvedValue(completion());
    await new WebMcpOllamaProvider({ config }, fetcher).callApi(
      JSON.stringify(history),
      context,
    );
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(JSON.parse(sent.messages.at(-1).content)).toEqual({
      text: 'Prima parte.',
      nextOffset: 12,
    });
    expect(sent.messages.at(-2).role).toBe('assistant');
  });

  it('non condivide risposte simulate e stato fra casi', async () => {
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      const body = JSON.parse(options.body);
      return Promise.resolve(
        body.messages.some(
          (message: { role: string }) => message.role === 'tool',
        )
          ? completion()
          : completion('list_members', { query: 'Ada' }),
      );
    });
    const provider = new WebMcpOllamaProvider({ config }, fetcher);
    const first = await provider.callApi(JSON.stringify(messages), context);
    const second = await provider.callApi(JSON.stringify(messages), context);
    expect(first.output).toEqual(second.output);
    expect(
      second.metadata.messages.filter(
        (message: { role: string }) => message.role === 'tool',
      )[0].content,
    ).toBe(JSON.stringify(expectedCall[0].mockOutput));
  });

  it('separa un errore HTTP da una selezione errata e conserva la traccia parziale', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(completion('list_members', { query: 'Ada' }))
      .mockResolvedValueOnce(new Response('errore', { status: 503 }));
    const response = await new WebMcpOllamaProvider(
      { config },
      fetcher,
    ).callApi(JSON.stringify(messages), context);
    expect(response.error).toContain('503');
    expect(response.metadata.toolCalls).toHaveLength(1);
  });

  it('annulla una richiesta che supera il timeout', async () => {
    const fetcher = vi.fn(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(options.signal.reason),
            { once: true },
          );
        }),
    );
    const response = await new WebMcpOllamaProvider(
      { config },
      fetcher,
    ).callApi(JSON.stringify(messages), context);
    expect(response.error).toBeDefined();
  });

  it('fallisce quando il modello raggiunge i limiti di generazione o di passi', async () => {
    const length = new Response(
      JSON.stringify({
        done: true,
        done_reason: 'length',
        message: { role: 'assistant', content: 'Parziale' },
      }),
    );
    const response = await new WebMcpOllamaProvider(
      { config },
      vi.fn().mockResolvedValue(length),
    ).callApi(JSON.stringify(messages), context);
    expect(
      assertTrajectory(response.output, {
        ...context,
        providerResponse: response,
      }).pass,
    ).toBe(false);
    const repeated = await new WebMcpOllamaProvider(
      { config: { ...config, maxSteps: 1 } },
      vi.fn().mockResolvedValue(completion('list_members', { query: 'Ada' })),
    ).callApi(JSON.stringify(messages), context);
    expect(repeated.metadata.stopReason).toBe('max_steps');
    expect(
      assertTrajectory(repeated.output, {
        ...context,
        providerResponse: repeated,
      }).pass,
    ).toBe(false);
  });

  it('rifiuta chiamate extra, ordine errato e argomenti errati; accetta i pattern esistenti', () => {
    const response = { metadata: { stopReason: 'completed' } };
    const calls = (
      entries: { functionName: string; arguments: Record<string, unknown> }[],
    ) =>
      entries.map((entry) => ({
        type: 'function',
        function: {
          name: entry.functionName,
          arguments: JSON.stringify(entry.arguments),
        },
      }));
    const gradingContext = { ...context, providerResponse: response };
    expect(
      assertTrajectory(calls(expectedCall.toReversed()), gradingContext).pass,
    ).toBe(false);
    expect(
      assertTrajectory(
        calls([...expectedCall, expectedCall[0]]),
        gradingContext,
      ).pass,
    ).toBe(false);
    expect(
      assertTrajectory(
        calls([
          { ...expectedCall[0], arguments: { query: 'Grace' } },
          expectedCall[1],
        ]),
        gradingContext,
      ).pass,
    ).toBe(false);
    const pattern = {
      vars: {
        expectedCall: JSON.stringify([
          {
            functionName: 'list_members',
            arguments: { query: { $pattern: '^Ad' } },
          },
        ]),
      },
      providerResponse: response,
    };
    expect(assertTrajectory(calls([expectedCall[0]]), pattern).pass).toBe(true);
    expect(
      assertTrajectory(JSON.stringify(calls(expectedCall)), gradingContext)
        .pass,
    ).toBe(true);
    expect(assertTrajectory('JSON non valido', gradingContext).pass).toBe(
      false,
    );
  });
});
