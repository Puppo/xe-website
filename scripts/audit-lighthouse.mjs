import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import lighthouse, { desktopConfig } from 'lighthouse';
import config from '../lighthouserc.mjs';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.txt',
  '.xml',
]);

const DEFAULT_SCORE = 0;
const EPHEMERAL_PORT = 0;
const EXIT_FAILURE = 1;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const JSON_INDENT = 2;
const PASSING_SCORE = 1;
const PERCENT_MULTIPLIER = 100;
const PRESET_ARG_PREFIX = '--preset=';
const REPORT_DIR = '.lighthouseci';
const REPORT_PAD_LENGTH = 2;

async function startStaticServer(distDir) {
  const rootDir = resolve(process.cwd(), distDir);
  const server = createServer(async (req, res) => {
    const urlPath = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    const relativePath = urlPath.endsWith('/')
      ? `${urlPath}index.html`
      : urlPath;
    const filePath = join(rootDir, relativePath);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      const headers = {
        'Cache-Control': 'public, max-age=31536000',
        'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
      };
      const acceptEncoding = req.headers['accept-encoding'] ?? '';
      if (COMPRESSIBLE_EXTENSIONS.has(ext) && acceptEncoding.includes('gzip')) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(HTTP_OK, headers);
        res.end(gzipSync(data));
      } else {
        res.writeHead(HTTP_OK, headers);
        res.end(data);
      }
    } catch {
      res.writeHead(HTTP_NOT_FOUND, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  await new Promise((resolveListen) => {
    server.listen(EPHEMERAL_PORT, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port =
    typeof address === 'object' && address ? address.port : EPHEMERAL_PORT;
  return {
    close: () =>
      new Promise((resolveClose) => {
        server.close(() => resolveClose());
      }),
    origin: `http://127.0.0.1:${port}`,
  };
}

function createLighthouseConfig(formFactor) {
  const baseSettings =
    formFactor === 'desktop'
      ? {
          ...desktopConfig.settings,
          ...config.settings,
        }
      : {
          ...config.settings,
          throttling: {
            cpuSlowdownMultiplier: PASSING_SCORE,
          },
        };
  return {
    extends: 'lighthouse:default',
    settings: baseSettings,
  };
}

function evaluateAssertions(path, formFactor, lhr) {
  const failures = [];
  const warnings = [];

  for (const [categoryId, minScore] of Object.entries(
    config.thresholds.categories,
  )) {
    const actual = lhr.categories[categoryId]?.score ?? DEFAULT_SCORE;
    if (actual < minScore) {
      failures.push(
        `[${formFactor}] ${path} category "${categoryId}" scored ${Math.round(actual * PERCENT_MULTIPLIER)} (expected >= ${Math.round(minScore * PERCENT_MULTIPLIER)})`,
      );
    }
  }

  for (const [categoryId, minScore] of Object.entries(
    config.thresholds.warnCategories ?? {},
  )) {
    const actual = lhr.categories[categoryId]?.score ?? DEFAULT_SCORE;
    if (actual < minScore) {
      warnings.push(
        `[${formFactor}] ${path} category "${categoryId}" scored ${Math.round(actual * PERCENT_MULTIPLIER)} (warn threshold ${Math.round(minScore * PERCENT_MULTIPLIER)})`,
      );
    }
  }

  for (const [auditId, level] of Object.entries(
    config.thresholds.audits ?? {},
  )) {
    const audit = lhr.audits[auditId];
    if (!audit || audit.scoreDisplayMode === 'notApplicable') continue;
    if (audit.score !== PASSING_SCORE) {
      const detail =
        audit.explanation || audit.displayValue || `score=${audit.score}`;
      const message = `[${formFactor}] ${path} audit "${auditId}" failed (${detail})`;
      if (level === 'error') failures.push(message);
      else warnings.push(message);
    }
  }

  return { failures, warnings };
}

function formatSummaryTable(runs) {
  const lines = [
    '| Path | Form Factor | Performance | Accessibility | Best Practices | SEO | Agentic Browsing |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const run of runs) {
    const pct = (id) =>
      run.scores[id] === undefined
        ? 'N/A'
        : Math.round(run.scores[id] * PERCENT_MULTIPLIER);
    lines.push(
      `| \`${run.path}\` | ${run.formFactor} | ${pct('performance')} | ${pct('accessibility')} | ${pct('best-practices')} | ${pct('seo')} | ${pct('agentic-browsing')} |`,
    );
  }
  return lines.join('\n');
}

async function allocateDebugPort() {
  const probe = createServer();
  await new Promise((resolveListen) => {
    probe.listen(EPHEMERAL_PORT, '127.0.0.1', resolveListen);
  });
  const address = probe.address();
  const port =
    typeof address === 'object' && address ? address.port : EPHEMERAL_PORT;
  await new Promise((resolveClose) => {
    probe.close(() => resolveClose());
  });
  return port;
}

async function runPreset(formFactor, origin, reportIndex) {
  const debugPort = await allocateDebugPort();
  const executablePath = process.env.CHROME_PATH || chromium.executablePath();
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${debugPort}`, '--enable-features=WebMCP'],
    executablePath,
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  });

  const runs = [];
  const failures = [];
  const warnings = [];
  const lhConfig = createLighthouseConfig(formFactor);

  try {
    for (const path of config.paths) {
      const url = `${origin}${path}`;
      // oxlint-disable-next-line no-console -- Progress output helps diagnose slow pages in CI.
      console.log(`Auditing [${formFactor}] ${path}...`);
      const result = await lighthouse(
        url,
        { logLevel: 'error', output: 'json', port: debugPort },
        lhConfig,
      );
      if (!result?.lhr) {
        throw new Error(`Lighthouse did not return an LHR for ${url}`);
      }
      const { lhr } = result;
      const slug =
        path === '/'
          ? 'index'
          : path.replaceAll(/^\/|\/$/gu, '').replaceAll('/', '-');
      const reportFile = join(
        REPORT_DIR,
        `lhr-${formFactor}-${String(reportIndex.value).padStart(REPORT_PAD_LENGTH, '0')}-${slug}.json`,
      );
      reportIndex.value += PASSING_SCORE;
      await writeFile(reportFile, JSON.stringify(lhr, null, JSON_INDENT));

      runs.push({
        formFactor,
        path,
        scores: Object.fromEntries(
          Object.entries(lhr.categories).map(([id, cat]) => [id, cat.score]),
        ),
      });

      const evaluation = evaluateAssertions(path, formFactor, lhr);
      failures.push(...evaluation.failures);
      warnings.push(...evaluation.warnings);
    }
  } finally {
    await browser.close();
  }

  return { failures, runs, warnings };
}

async function main() {
  const presetArg = process.argv.find((arg) =>
    arg.startsWith(PRESET_ARG_PREFIX),
  );
  const requestedPreset = presetArg?.slice(PRESET_ARG_PREFIX.length);
  const presets = requestedPreset ? [requestedPreset] : ['mobile', 'desktop'];

  await rm(REPORT_DIR, { force: true, recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const server = await startStaticServer(config.staticDistDir);
  const allRuns = [];
  const allFailures = [];
  const allWarnings = [];
  const reportIndex = { value: PASSING_SCORE };

  try {
    for (const preset of presets) {
      const { failures, runs, warnings } = await runPreset(
        preset,
        server.origin,
        reportIndex,
      );
      allRuns.push(...runs);
      allFailures.push(...failures);
      allWarnings.push(...warnings);
    }
  } finally {
    await server.close();
  }

  const summary = formatSummaryTable(allRuns);
  // oxlint-disable-next-line no-console -- Lighthouse summaries are user-facing diagnostics.
  console.log(`\n${summary}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, {
      flag: 'a',
    });
  }

  for (const warning of allWarnings) {
    // oxlint-disable-next-line no-console -- Warnings are non-fatal diagnostics.
    console.warn(`WARN: ${warning}`);
  }

  if (allFailures.length > DEFAULT_SCORE) {
    for (const failure of allFailures) {
      // oxlint-disable-next-line no-console -- Failures must be reported clearly.
      console.error(`ERROR: ${failure}`);
    }
    process.exit(EXIT_FAILURE);
  }
}

await main();
