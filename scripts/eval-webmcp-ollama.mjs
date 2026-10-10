import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkEvaluationReport,
  checkModelSupport,
  installedModel,
  ollamaEndpoints,
  pageTools,
} from './lib/webmcp-evals.mjs';

const root = new URL('../', import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));

async function serverJson(base, path, body) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(
      `Ollama is unreachable at ${base}: ${error.message}. Check OLLAMA_HOST and the running server on a sufficiently capable machine.`,
      { cause: error },
    );
  }
  if (!response.ok) throw new Error(`Ollama ${path}: HTTP ${response.status}`);
  return response.json();
}

function runCli(args, env, timeoutMs) {
  return new Promise((resolve, reject) => {
    const grouped = process.platform !== 'win32';
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args,
      {
        cwd: root,
        env,
        stdio: 'inherit',
        detached: grouped,
      },
    );
    let timedOut = false;
    let forceTimer;
    const stop = (signal) => {
      if (!child.pid) return;
      try {
        if (grouped) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error.code !== 'ESRCH') reject(error);
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
      forceTimer = setTimeout(() => stop('SIGKILL'), 5000);
      forceTimer.unref();
    }, timeoutMs);
    const interrupt = () => stop('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const clean = () => {
      clearTimeout(timer);
      clearTimeout(forceTimer);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    };
    child.once('error', (error) => {
      clean();
      reject(error);
    });
    child.once('close', (code) => {
      clean();
      if (timedOut) reject(new Error('Evaluation stopped: 15-minute timeout.'));
      else if (code === 0 || code === 100) {
        resolve(code);
      } else {
        reject(new Error(`Runner exited with code ${code}.`));
      }
    });
  });
}

async function main() {
  const config = await readJson('docs/webmcp/ollama.json');
  const model = process.env.OLLAMA_MODEL || config.model;
  const { base } = ollamaEndpoints(
    process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  );
  const tags = await serverJson(base, '/api/tags');
  const installed = installedModel(
    tags,
    model,
    process.env.OLLAMA_MODEL_DIGEST,
  );
  const details = await serverJson(base, '/api/show', { model });
  checkModelSupport(details, model, config.think);

  const cases = await readJson('docs/webmcp/evals.json');
  const schema = pageTools(
    await readJson('docs/webmcp/schema.json'),
    config.tools,
  );
  const outputRoot = new URL('.evals/', root);
  await mkdir(outputRoot, { recursive: true });
  const output = await mkdtemp(join(fileURLToPath(outputRoot), 'ollama-'));
  const toolFile = join(output, 'tools.json');
  await writeFile(toolFile, JSON.stringify(schema, null, 2));
  await writeFile(
    join(output, 'environment.json'),
    JSON.stringify(
      {
        runner: 'promptfoo',
        ...config,
        model,
        digest: installed.digest,
        modelMetadata: {
          name: details.model_info?.['general.name'],
          finetune: details.model_info?.['general.finetune'],
          thinking: details.thinking,
        },
        host: base,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    `Local Ollama: ${model}; sequential cases: ${cases.length}; reports: ${output}`,
  );
  const cliCode = await runCli(
    [
      '--yes',
      `promptfoo@${config.runnerVersion}`,
      'eval',
      '--config',
      'docs/webmcp/promptfooconfig.mjs',
      '--output',
      join(output, 'report.json'),
      join(output, 'report.html'),
      '--max-concurrency',
      '1',
      '--no-cache',
      '--no-write',
      '--no-share',
      '--no-progress-bar',
      '--no-table',
    ],
    {
      ...process.env,
      OLLAMA_HOST: base,
      OLLAMA_MODEL: model,
      PROMPTFOO_CONFIG_DIR: join(output, 'promptfoo'),
      PROMPTFOO_DISABLE_TELEMETRY: '1',
      PROMPTFOO_DISABLE_UPDATE: '1',
      PROMPTFOO_PASS_RATE_THRESHOLD: '100',
      PROMPTFOO_FAILED_TEST_EXIT_CODE: '100',
    },
    config.timeoutMs,
  );
  const report = JSON.parse(
    await readFile(join(output, 'report.json'), 'utf8'),
  );
  const checked = checkEvaluationReport(report, cases);
  if ((cliCode === 0) !== (checked.exitCode === 0))
    throw new Error('Runner exit code is inconsistent with the report.');
  console.log(
    `Passed cases: ${checked.counts.pass}; assertion failures: ${checked.counts.fail}; execution/provider errors: ${checked.counts.error}.`,
  );
  process.exitCode = checked.exitCode;
}

try {
  await main();
} catch (error) {
  console.error(
    `Evaluation did not complete (configuration/provider/runner): ${error.message}`,
  );
  process.exitCode = 2;
}
