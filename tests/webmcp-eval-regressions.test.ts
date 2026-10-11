import { describe, expect, it, vi } from 'vitest';
import { assertTrajectory } from '../scripts/lib/webmcp-promptfoo-assertion.mjs';
import WebMcpOllamaProvider from '../scripts/webmcp-promptfoo-provider.mjs';

interface ExpectedCall {
  functionName: string;
  arguments: Record<string, unknown>;
  mockOutput: Record<string, unknown>;
  dependsOn?: number[];
}

interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

const expected: ExpectedCall[] = [
  {
    functionName: 'list_members',
    arguments: { query: 'Ada' },
    mockOutput: { members: [{ slug: 'ada' }], nextOffset: null },
  },
  {
    functionName: 'get_member',
    arguments: { slug: 'ada' },
    mockOutput: { name: 'Ada', biography: 'Biografia.' },
    dependsOn: [0],
  },
];
const [discovery, profile] = expected;
const config = {
  base: 'http://localhost:11434',
  model: 'test-model',
  tools: ['list_members', 'get_member'].map((name) => ({
    type: 'function',
    function: { name, description: name, parameters: { type: 'object' } },
  })),
  maxSteps: 4,
  requestTimeoutMs: 50,
  generationTokens: 1024,
  contextTokens: 8192,
  think: false,
};
const history = JSON.stringify([
  {
    role: 'user',
    type: 'message',
    content: 'Trova Ada e leggi il suo profilo.',
  },
]);

function tool(name: string, args: Record<string, unknown>): ToolCall {
  return { function: { name, arguments: args } };
}

function completion(calls: ToolCall[] = []): Response {
  return Response.json({
    done: true,
    done_reason: 'stop',
    message: {
      role: 'assistant',
      content: calls.length > 0 ? '' : 'Ada: Biografia.',
      tool_calls: calls,
    },
  });
}

async function runConversation(
  turns: ToolCall[][],
  expectedCall: ExpectedCall[] = expected,
) {
  const fetcher = vi.fn();
  for (const turn of turns) fetcher.mockResolvedValueOnce(completion(turn));
  fetcher.mockResolvedValueOnce(completion());
  const context = {
    vars: { expectedCall: JSON.stringify(expectedCall) },
  };
  const response = await new WebMcpOllamaProvider({ config }, fetcher).callApi(
    history,
    context,
  );
  return {
    response,
    grade: assertTrajectory(response.output, {
      ...context,
      providerResponse: response,
    }),
  };
}

const incorrectArguments = [
  {
    name: 'an unrelated members page',
    index: 0,
    arguments: { query: 'Ada', offset: 999 },
  },
  {
    name: 'links instead of the profile overview',
    index: 1,
    arguments: { slug: 'ada', section: 'links' },
  },
];

describe('WebMCP evaluation argument calibration', () => {
  it.each(incorrectArguments)('rejects $name', async (testCase) => {
    const calls = expected.map((entry, index) =>
      tool(
        entry.functionName,
        index === testCase.index ? testCase.arguments : entry.arguments,
      ),
    );
    const { grade } = await runConversation(calls.map((call) => [call]));
    expect(grade.pass).toBe(false);
  });

  it.each(incorrectArguments)(
    'does not supply the expected mock for $name',
    async (testCase) => {
      const calls = expected.map((entry, index) =>
        tool(
          entry.functionName,
          index === testCase.index ? testCase.arguments : entry.arguments,
        ),
      );
      const { response } = await runConversation(calls.map((call) => [call]));
      const { result } = response.metadata.toolCalls[testCase.index];
      expect(result).not.toEqual(expected[testCase.index].mockOutput);
      expect(result).toMatchObject({ retryable: false });
    },
  );

  it('accepts explicit runtime defaults in place of omitted arguments', async () => {
    const { grade, response } = await runConversation([
      [tool('list_members', { query: 'Ada', offset: 0 })],
      [tool('get_member', { slug: 'ada', section: 'overview', offset: 0 })],
    ]);
    expect(grade.pass).toBe(true);
    expect(
      response.metadata.toolCalls.map(
        (call: { result: unknown }) => call.result,
      ),
    ).toEqual(expected.map((entry) => entry.mockOutput));
  });

  it('accepts omitted runtime defaults when the fixture specifies them', async () => {
    const explicitDefaults = expected.map((entry) => ({
      ...entry,
      arguments: {
        ...entry.arguments,
        offset: 0,
        ...(entry.functionName === 'get_member' ? { section: 'overview' } : {}),
      },
    }));
    const { grade } = await runConversation(
      [
        [tool('list_members', { query: 'Ada' })],
        [tool('get_member', { slug: 'ada' })],
      ],
      explicitDefaults,
    );
    expect(grade.pass).toBe(true);
  });

  it('matches fixture patterns for both grading and mock selection', async () => {
    const patterned = [
      {
        ...discovery,
        arguments: { query: { $pattern: '^Ad[a-z]*$' } },
      },
      profile,
    ];
    const { grade, response } = await runConversation(
      [
        [tool('list_members', { query: 'Ada' })],
        [tool('get_member', { slug: 'ada' })],
      ],
      patterned,
    );
    expect(grade.pass).toBe(true);
    const [discoveryResult] = response.metadata.toolCalls;
    expect(discoveryResult.result).toEqual(discovery.mockOutput);
  });
});

describe('WebMCP evaluation prerequisite calibration', () => {
  it('rejects a guessed profile lookup batched with its discovery call', async () => {
    const { grade } = await runConversation([
      [
        tool('list_members', { query: 'Ada' }),
        tool('get_member', { slug: 'ada' }),
      ],
    ]);
    expect(grade.pass).toBe(false);
  });

  it('accepts a profile lookup after receiving the discovery result', async () => {
    const { grade } = await runConversation([
      [tool('list_members', { query: 'Ada' })],
      [tool('get_member', { slug: 'ada' })],
    ]);
    expect(grade.pass).toBe(true);
  });

  it('accepts independent reads batched in one assistant message', async () => {
    const independent: ExpectedCall[] = [
      discovery,
      {
        functionName: 'get_member',
        arguments: { slug: 'ada' },
        mockOutput: profile.mockOutput,
      },
    ];
    const { grade } = await runConversation(
      [
        [
          tool('list_members', { query: 'Ada' }),
          tool('get_member', { slug: 'ada' }),
        ],
      ],
      independent,
    );
    expect(grade.pass).toBe(true);
  });

  it('fails closed when dependency evidence is missing from provider metadata', () => {
    const output = expected.map((entry) => ({
      type: 'function',
      function: {
        name: entry.functionName,
        arguments: JSON.stringify(entry.arguments),
      },
    }));
    const grade = assertTrajectory(output, {
      vars: { expectedCall: JSON.stringify(expected) },
      providerResponse: { metadata: { stopReason: 'completed' } },
    });
    expect(grade.pass).toBe(false);
  });
});
