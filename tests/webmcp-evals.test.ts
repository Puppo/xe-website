import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkEvaluationReport,
  checkModelSupport,
  installedModel,
  ollamaEndpoints,
  pageTools,
} from '../scripts/lib/webmcp-evals.mjs';

const cases = [
  {
    name: 'Profilo',
    expectedCall: [
      { functionName: 'list_members' },
      { functionName: 'get_member' },
    ],
  },
  {
    name: 'Materiali',
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

describe('valutazioni WebMCP con Ollama locale', () => {
  it('rifiuta un modello assente o pesi diversi da quelli fissati in CI', () => {
    const tags = { models: [{ name: 'qwen3:4b', digest: 'corretto' }] };
    expect(installedModel(tags, 'qwen3:4b', 'corretto')).toEqual(
      tags.models[0],
    );
    expect(() => installedModel(tags, 'qwen3:4b', 'diverso')).toThrow();
    expect(() => installedModel(tags, 'inesistente', undefined)).toThrow();
  });
  it('rifiuta thinking obbligatorio quando il profilo richiede think:false', () => {
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
        'ibrido',
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
      checkModelSupport({ capabilities: [] }, 'senza strumenti', false),
    ).toThrow();
  });

  it('accetta soltanto un rapporto completo e riuscito', () => {
    expect(checkEvaluationReport(report(), cases)).toMatchObject({
      exitCode: 0,
    });
  });

  it('fallisce per errori del provider anche se la CLI termina con zero', () => {
    expect(
      checkEvaluationReport(report([row(0, 'error'), row(1, 'error')]), cases),
    ).toMatchObject({ exitCode: 2 });
  });

  it('distingue una selezione errata da un errore del provider', () => {
    expect(
      checkEvaluationReport(report([row(0, 'fail'), row(1)]), cases),
    ).toMatchObject({ exitCode: 1 });
  });

  it('rifiuta casi mancanti, duplicati, esiti e contatori incoerenti', () => {
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

  it('normalizza gli endpoint e rifiuta credenziali e percorsi inattesi', () => {
    expect(ollamaEndpoints('http://127.0.0.1:11434/v1/')).toEqual({
      base: 'http://127.0.0.1:11434',
      chat: 'http://127.0.0.1:11434/v1',
    });
    expect(() => ollamaEndpoints('https://example.com/proxy')).toThrow();
    expect(() =>
      ollamaEndpoints('http://user:secret@localhost:11434'),
    ).toThrow();
  });

  it('offre il catalogo completo della pagina e rifiuta strumenti inesistenti', () => {
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
    expect(() => pageTools(schema, ['inesistente'])).toThrow();
    expect(() => pageTools(schema, ['get_member', 'get_member'])).toThrow();
  });

  it('mantiene risposte simulate complete e offset coerenti nelle conversazioni', () => {
    const fixtures = JSON.parse(
      readFileSync(
        new URL('../docs/webmcp/evals.json', import.meta.url),
        'utf8',
      ),
    );
    for (const test of fixtures) {
      for (const call of test.expectedCall) {
        expect(call.mockOutput).toBeDefined();
        expect(JSON.stringify(call.mockOutput).length).toBeLessThanOrEqual(
          1500,
        );
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
