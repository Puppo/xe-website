import { readFileSync } from 'node:fs';
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
interface ContinuationCase {
  name: string;
  messages: [
    { content: string },
    { name: string; arguments: Record<string, unknown> },
    { name: string; response: { result: unknown } },
  ];
  expectedCall: unknown[];
}
const continuationCases: ContinuationCase[] = JSON.parse(
  readFileSync(new URL('../docs/webmcp/evals.json', import.meta.url), 'utf8'),
).filter((entry: { messages: { type: string }[] }) =>
  entry.messages.some((message) => message.type === 'functionresponse'),
);
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

describe('Promptfoo conversations with Ollama', () => {
  it('retains generated tokens when the native response has no parsed tool call', async () => {
    const generated = '<tool_call>{"name":"list_members"}</tool_call>';
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        done: true,
        done_reason: 'stop',
        message: { role: 'assistant', content: '' },
        logprobs: [{ token: generated }],
      }),
    );
    const response = await new WebMcpOllamaProvider(
      { config },
      fetcher,
    ).callApi(JSON.stringify(messages), context);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).logprobs).toBe(true);
    expect(response.metadata.generations).toEqual([
      { text: generated, doneReason: 'stop' },
    ]);
    expect(response.output).toEqual([]);
    expect(
      assertTrajectory(response.output, {
        ...context,
        providerResponse: response,
      }).pass,
    ).toBe(false);
  });

  it.each(continuationCases)(
    'keeps the original goal and rejects premature completion: $name',
    async (testCase) => {
      const fetcher = vi.fn().mockResolvedValue(completion());
      const fixtureContext = {
        vars: { expectedCall: JSON.stringify(testCase.expectedCall) },
      };
      const response = await new WebMcpOllamaProvider(
        { config },
        fetcher,
      ).callApi(JSON.stringify(testCase.messages), fixtureContext);
      const sent = JSON.parse(fetcher.mock.calls[0][1].body);
      expect(sent.messages[1]).toEqual({
        role: 'user',
        content: testCase.messages[0].content,
      });
      expect(sent.messages[2].tool_calls[0].function).toEqual({
        name: testCase.messages[1].name,
        arguments: testCase.messages[1].arguments,
      });
      expect(sent.messages[3]).toEqual({
        role: 'tool',
        tool_name: testCase.messages[2].name,
        content: JSON.stringify(testCase.messages[2].response.result),
      });
      expect(
        assertTrajectory(response.output, {
          ...fixtureContext,
          providerResponse: response,
        }).pass,
      ).toBe(false);
    },
  );

  it('executes the complete chain and returns mock results to the model', async () => {
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

  it('preserves structured results from the existing conversation', async () => {
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

  it('isolates mock responses and state between cases', async () => {
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

  it('distinguishes HTTP errors from incorrect selection and preserves the partial trace', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(completion('list_members', { query: 'Ada' }))
      .mockResolvedValueOnce(new Response('error', { status: 503 }));
    const response = await new WebMcpOllamaProvider(
      { config },
      fetcher,
    ).callApi(JSON.stringify(messages), context);
    expect(response.error).toContain('503');
    expect(response.metadata.toolCalls).toHaveLength(1);
  });

  it('aborts a request that exceeds its timeout', async () => {
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

  it('fails when generation or step limits are reached', async () => {
    const length = new Response(
      JSON.stringify({
        done: true,
        done_reason: 'length',
        message: { role: 'assistant', content: 'Partial' },
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

  it('rejects extra calls, incorrect order and arguments while accepting fixture patterns', () => {
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
    expect(assertTrajectory('Invalid JSON', gradingContext).pass).toBe(false);
  });
});
