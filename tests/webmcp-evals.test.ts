import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkEvaluationReport,
  checkModelSupport,
  evaluationModel,
  installedModel,
  loadEvaluationSuite,
  ollamaEndpoints,
  pageTools,
} from '../scripts/lib/webmcp-evals.mjs';

const cases = [
  {
    name: 'Profile',
    expectedCall: [
      { functionName: 'list_members' },
      { functionName: 'get_member' },
    ],
  },
  {
    name: 'Materials',
    expectedCall: [{ functionName: 'search_event_materials' }],
  },
];
const row = (testIdx: number, outcome = 'pass') => ({
  testIdx,
  promptIdx: 0,
  testCase: { description: cases[testIdx].name },
  success: outcome === 'pass',
  failureReason: outcome === 'pass' ? 0 : outcome === 'fail' ? 1 : 2,
});
const report = (results = [row(0), row(1)]) => ({
  results: {
    version: 3,
    stats: {
      successes: results.filter((entry) => entry.success).length,
      failures: results.filter((entry) => entry.failureReason === 1).length,
      errors: results.filter((entry) => entry.failureReason === 2).length,
    },
    results,
  },
});

describe('WebMCP evaluations with local Ollama', () => {
  it('pins the default model locally and allows explicit experiment overrides', () => {
    const config = { model: 'default:model', modelDigest: 'default-digest' };
    expect(evaluationModel(config, {})).toEqual({
      model: config.model,
      digest: config.modelDigest,
    });
    expect(evaluationModel(config, { OLLAMA_MODEL: config.model }).digest).toBe(
      config.modelDigest,
    );
    expect(
      evaluationModel(config, { OLLAMA_MODEL: 'experiment:model' }),
    ).toEqual({
      model: 'experiment:model',
      digest: undefined,
    });
    expect(
      evaluationModel(config, {
        OLLAMA_MODEL: 'experiment:model',
        OLLAMA_MODEL_DIGEST: 'experiment-digest',
      }).digest,
    ).toBe('experiment-digest');
  });

  it('keeps development and held-out suites separate and rejects unknown selections', () => {
    const regression = loadEvaluationSuite('regression');
    const heldout = loadEvaluationSuite('heldout');
    expect(regression.cases).toHaveLength(6);
    expect(heldout.cases).toHaveLength(6);
    expect(regression.name).toBe('regression');
    expect(heldout.name).toBe('heldout');
    const developmentNames = new Set(
      regression.cases.map((entry: { name: string }) => entry.name),
    );
    for (const entry of heldout.cases)
      expect(developmentNames.has(entry.name)).toBe(false);
    expect(() => loadEvaluationSuite('unknown')).toThrow('suite');
    expect(() => loadEvaluationSuite('__proto__')).toThrow('suite');
  });

  it('rejects missing models and weights that differ from the CI pin', () => {
    const tags = { models: [{ name: 'qwen3:4b', digest: 'correct' }] };
    expect(installedModel(tags, 'qwen3:4b', 'correct')).toEqual(tags.models[0]);
    expect(() => installedModel(tags, 'qwen3:4b', 'different')).toThrow();
    expect(() => installedModel(tags, 'missing', undefined)).toThrow();
  });
  it('rejects mandatory thinking when the profile requires think:false', () => {
    const capable = { capabilities: ['tools'] };
    expect(() => checkModelSupport(capable, 'instruct', false)).not.toThrow();
    expect(() =>
      checkModelSupport(
        { ...capable, model_info: { 'general.finetune': 'Thinking' } },
        'thinking',
        false,
      ),
    ).toThrow('thinking');
    expect(() =>
      checkModelSupport(
        { ...capable, thinking: { values: [true] } },
        'thinking',
        false,
      ),
    ).toThrow('thinking');
    expect(() =>
      checkModelSupport(
        { ...capable, thinking: { values: [false, true] } },
        'hybrid',
        false,
      ),
    ).not.toThrow();
    expect(() =>
      checkModelSupport(
        { ...capable, thinking: { values: [true] } },
        'thinking',
        true,
      ),
    ).not.toThrow();
    expect(() =>
      checkModelSupport({ capabilities: [] }, 'without tools', false),
    ).toThrow();
  });

  it('accepts only a complete successful report', () => {
    expect(checkEvaluationReport(report(), cases)).toMatchObject({
      exitCode: 0,
    });
  });

  it('fails on provider errors even if the CLI exits with zero', () => {
    expect(
      checkEvaluationReport(report([row(0, 'error'), row(1, 'error')]), cases),
    ).toMatchObject({ exitCode: 2 });
  });

  it('distinguishes incorrect selection from provider errors', () => {
    expect(
      checkEvaluationReport(report([row(0, 'fail'), row(1)]), cases),
    ).toMatchObject({ exitCode: 1 });
  });

  it('rejects missing or duplicate cases and inconsistent outcomes or counters', () => {
    for (const results of [
      [row(0)],
      [row(0), row(0)],
      [],
      [{ ...row(0), failureReason: 2 }, row(1)],
      [{ ...row(0), promptIdx: 1 }, row(1)],
    ]) {
      expect(() => checkEvaluationReport(report(results), cases)).toThrow();
    }
    const inconsistent = report();
    inconsistent.results.stats.successes = 100;
    expect(() => checkEvaluationReport(inconsistent, cases)).toThrow();
    expect(() => checkEvaluationReport(report(), [])).toThrow();
  });

  it('normalizes endpoints and rejects credentials or unexpected paths', () => {
    expect(ollamaEndpoints('http://127.0.0.1:11434/v1/')).toEqual({
      base: 'http://127.0.0.1:11434',
      chat: 'http://127.0.0.1:11434/v1',
    });
    expect(() => ollamaEndpoints('https://example.com/proxy')).toThrow();
    expect(() =>
      ollamaEndpoints('http://user:secret@localhost:11434'),
    ).toThrow();
  });

  it('offers the complete page catalog and rejects unknown tools', () => {
    const schema = JSON.parse(
      readFileSync(
        new URL('../docs/webmcp/schema.json', import.meta.url),
        'utf8',
      ),
    );
    const config = JSON.parse(
      readFileSync(
        new URL('../docs/webmcp/ollama.json', import.meta.url),
        'utf8',
      ),
    );
    expect(
      pageTools(schema, config.tools).tools.map(
        (tool: { name: string }) => tool.name,
      ),
    ).toEqual(config.tools);
    expect(config.tools).toHaveLength(8);
    expect(() => pageTools(schema, ['missing'])).toThrow();
    expect(() => pageTools(schema, ['get_member', 'get_member'])).toThrow();
  });

  it('preserves complete mock responses and consistent conversation offsets', () => {
    const fixtures = ['regression', 'heldout'].flatMap(
      (suite) => loadEvaluationSuite(suite).cases,
    );
    for (const test of fixtures) {
      for (const call of test.expectedCall) {
        expect(call.mockOutput).toBeDefined();
        expect(JSON.stringify(call.mockOutput).length).toBeLessThanOrEqual(
          1500,
        );
        if (typeof call.mockOutput.text === 'string') {
          expect(call.mockOutput.offset).toBe(call.arguments.offset ?? 0);
          expect(call.mockOutput.nextOffset ?? call.mockOutput.total).toBe(
            call.mockOutput.offset + call.mockOutput.text.length,
          );
        }
        for (const dependency of call.dependsOn ?? []) {
          expect(dependency).toBeGreaterThanOrEqual(0);
          expect(dependency).toBeLessThan(test.expectedCall.indexOf(call));
        }
      }
      for (const message of test.messages) {
        const result = message.response?.result;
        if (typeof result?.text === 'string' && result.nextOffset !== null) {
          expect(result.nextOffset).toBe(result.offset + result.text.length);
        }
      }
    }
  });
});
