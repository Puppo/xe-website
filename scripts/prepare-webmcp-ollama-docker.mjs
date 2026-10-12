import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  evaluationModel,
  installedModel,
  ollamaEndpoints,
} from './lib/webmcp-evals.mjs';

export async function prepareDockerModel({
  env = process.env,
  run = spawnSync,
  fetcher = globalThis.fetch,
} = {}) {
  const config = JSON.parse(
    readFileSync(
      new URL('../docs/webmcp/ollama.json', import.meta.url),
      'utf8',
    ),
  );
  const { model, digest } = evaluationModel(config, env);
  const { base } = ollamaEndpoints(env.OLLAMA_HOST || 'http://127.0.0.1:11434');
  if (!['http://127.0.0.1:11434', 'http://localhost:11434'].includes(base)) {
    throw new Error(
      'Docker preparation targets the local Compose server on port 11434. Use its loopback OLLAMA_HOST when preparing weights.',
    );
  }
  const result = run(
    'docker',
    [
      'compose',
      '-f',
      fileURLToPath(
        new URL('../docs/webmcp/compose.ollama.yml', import.meta.url),
      ),
      'exec',
      '-T',
      'ollama',
      'ollama',
      'pull',
      model,
    ],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      stdio: 'inherit',
      timeout: 600_000,
    },
  );
  if (result.error)
    throw new Error(
      `Docker model preparation failed: ${result.error.message}. Install Docker with Compose and start the Ollama service first.`,
      { cause: result.error },
    );
  if (result.status !== 0)
    throw new Error(
      `Docker Compose model pull failed (exit ${result.status}, signal ${result.signal ?? 'none'}).`,
    );
  const response = await fetcher(`${base}/api/tags`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Ollama model catalog: HTTP ${response.status}`);
  return installedModel(await response.json(), model, digest);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const installed = await prepareDockerModel();
    console.log(
      `Docker Ollama model ready: ${installed.name}; digest: ${installed.digest}. No inference was run.`,
    );
  } catch (error) {
    console.error(`Docker Ollama setup did not complete: ${error.message}`);
    process.exitCode = 2;
  }
}
