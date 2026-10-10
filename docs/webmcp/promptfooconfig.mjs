import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ollamaEndpoints, pageTools } from '../../scripts/lib/webmcp-evals.mjs';
import { assertTrajectory } from '../../scripts/lib/webmcp-promptfoo-assertion.mjs';

const readJson = (name) =>
  JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const config = readJson('ollama.json');
const cases = readJson('evals.json');
const schema = pageTools(readJson('schema.json'), config.tools);

export default {
  description: 'XeDotNet WebMCP conversations with local Ollama',
  prompts: ['{{messages}}'],
  providers: [
    {
      id: `file://${fileURLToPath(new URL('../../scripts/webmcp-promptfoo-provider.mjs', import.meta.url))}`,
      config: {
        ...config,
        base: ollamaEndpoints(
          process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
        ).base,
        model: process.env.OLLAMA_MODEL || config.model,
        tools: schema.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
      },
    },
  ],
  evaluateOptions: { maxConcurrency: 1 },
  tests: cases.map((test) => ({
    description: test.name,
    vars: {
      messages: JSON.stringify(test.messages),
      expectedCall: JSON.stringify(test.expectedCall),
    },
    assert: [
      { type: 'is-valid-openai-tools-call', metric: 'schema' },
      { type: 'javascript', value: assertTrajectory, metric: 'trajectory' },
    ],
  })),
};
