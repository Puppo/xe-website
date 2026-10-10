import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkEvaluationReport,
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
const row = (name: string, stepIndex: number, outcome = 'pass') => ({
  test: { name },
  runIndex: 1,
  stepIndex,
  outcome,
});
const report = (
  results = [row('Profilo', 1), row('Profilo', 2), row('Materiali', 1)],
) => ({
  results: {
    testCount: 2,
    passCount: results.filter((entry) => entry.outcome === 'pass').length,
    failCount: results.filter((entry) => entry.outcome === 'fail').length,
    errorCount: results.filter((entry) => entry.outcome === 'error').length,
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
  it('accetta soltanto un rapporto completo e riuscito', () => {
    expect(checkEvaluationReport(report(), cases)).toMatchObject({
      exitCode: 0,
    });
  });

  it('fallisce per errori del provider anche se la CLI termina con zero', () => {
    expect(
      checkEvaluationReport(
        report([row('Profilo', 1, 'error'), row('Materiali', 1, 'error')]),
        cases,
      ),
    ).toMatchObject({ exitCode: 2 });
  });

  it('distingue una selezione errata da un errore del provider', () => {
    expect(
      checkEvaluationReport(
        report([
          row('Profilo', 1, 'fail'),
          row('Profilo', 2),
          row('Materiali', 1),
        ]),
        cases,
      ),
    ).toMatchObject({ exitCode: 1 });
  });

  it('rifiuta casi mancanti, passi duplicati e contatori incoerenti', () => {
    expect(() =>
      checkEvaluationReport(
        report([row('Profilo', 1), row('Profilo', 2)]),
        cases,
      ),
    ).toThrow();
    expect(() =>
      checkEvaluationReport(
        report([row('Profilo', 1), row('Profilo', 1), row('Materiali', 1)]),
        cases,
      ),
    ).toThrow();
    const inconsistent = report();
    inconsistent.results.passCount = 100;
    expect(() => checkEvaluationReport(inconsistent, cases)).toThrow();
    expect(() =>
      checkEvaluationReport(
        report([row('Profilo', 1), row('Materiali', 1)]),
        cases,
      ),
    ).toThrow();
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
