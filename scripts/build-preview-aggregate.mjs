#!/usr/bin/env node
/**
 * Build an aggregate dist/ that contains every active PR preview under its
 * `pr-{N}/` subfolder, suitable for deploying to a single Netlify site via
 * `netlify deploy --dir=dist-aggregate --prod`.
 *
 * State lives in `.state/state.json` (kept on the `netlify-state` branch by
 * the workflow). Inputs come from environment variables:
 *
 *   PR_NUMBER       PR being opened / synchronized / closed / dispatched
 *   EVENT           `pull_request` or `workflow_dispatch`
 *   ACTION          pull_request action (`opened`, `synchronize`, `closed`, ...)
 *   GITHUB_REPOSITORY base repo in `owner/name` form
 *   GITHUB_SHA      SHA of the PR being processed
 *   HEAD_REPO       full name of the PR head repo (defaults to GITHUB_REPOSITORY)
 *   HEAD_SHA        SHA of the PR head commit (defaults to GITHUB_SHA)
 *   CHECKOUT_TOKEN  PAT capable of reading fork PR heads (same-repo PRs do not
 *                   strictly need it, but the helper accepts it for both)
 *
 * The script does NOT deploy; it only produces `dist-aggregate/`. The calling
 * workflow handles the Netlify deploy and the `state.json` commit.
 *
 * Side effects only run when this file is the entry point (`import.meta.main`),
 * so the file can be imported by tests without triggering the build pipeline.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const SITE = 'https://xe-website-preview.netlify.app';
const ROOT = resolve(import.meta.dirname, '..');
const STATE_FILE = resolve(ROOT, '.state/state.json');
const STAGING = resolve(ROOT, 'staging');
const AGGREGATE = resolve(ROOT, 'dist-aggregate');
const ZERO = 0;
const INDENT_SPACES = 2;
const NODE_MODULES = 'node_modules';

/** Read the current state file, returning an empty state when absent. */
export function loadState(stateFile = STATE_FILE) {
  if (!existsSync(stateFile)) {
    return { previews: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8'));
    return {
      previews:
        parsed && typeof parsed === 'object' && parsed.previews
          ? parsed.previews
          : {},
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${stateFile}: ${message}`, {
      cause: error,
    });
  }
}

/**
 * Compute the desired state given the current state and an event. `remove`
 * wins over `add` when both are true (closed PRs stay closed).
 *
 * @param {{ previews: Record<string, { sha: string }> }} state
 * @param {{ prNumber: string, action: 'add' | 'remove', sha: string }} event
 */
export function nextState(state, event) {
  const previews = { ...state.previews };
  if (event.action === 'remove') {
    // Use `Reflect.deleteProperty` instead of the `delete` operator so the
    // Dynamic-key delete does not trip `typescript/no-dynamic-delete`.
    Reflect.deleteProperty(previews, event.prNumber);
  } else {
    previews[event.prNumber] = { sha: event.sha };
  }
  return { previews };
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

function fetchPullRequest(prNumber, context) {
  // Fetch the PR's head into the local repo so `git archive` can stream it.
  // GitHub exposes `pull/{N}/head` on the base repo for every PR, including
  // Fork PRs — the commits live in GitHub's namespace, not the fork's git
  // Remote — so this works for both same-repo and fork PRs.
  const remote = `https://x-access-token:${context.checkoutToken}@github.com/${context.githubRepository}.git`;
  run('git', ['fetch', '--depth=1', remote, `pull/${prNumber}/head`], {
    cwd: ROOT,
  });
}

function extractSourceViaTar(sha, target) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(target, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${sha} | tar -x -C ${target}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function linkNodeModules(target) {
  const link = resolve(target, NODE_MODULES);
  if (existsSync(link)) {
    return;
  }
  const source = resolve(ROOT, NODE_MODULES);
  if (!existsSync(source)) {
    throw new Error(
      `node_modules not found at ${source}; run \`npm ci\` first.`,
    );
  }
  symlinkSync(source, link);
}

function buildIn(cwd, prNumber) {
  const siteUrl = `${SITE}/pr-${prNumber}/`;
  run('npm', ['run', 'build'], {
    cwd,
    env: {
      ...process.env,
      SITE_URL: siteUrl,
      PUBLIC_NOINDEX: '1',
      NODE_ENV: 'production',
    },
  });
}

function buildCurrent(prNumber) {
  // Build in the workspace, which already has the PR checked out. Move the
  // Resulting `dist/` aside so subsequent rebuilds start clean.
  buildIn(ROOT, prNumber);
  const target = resolve(STAGING, `pr-${prNumber}`);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  cpSync(resolve(ROOT, 'dist'), target, { recursive: true });
}

function buildOther(prNumber, sha, context) {
  fetchPullRequest(prNumber, context);
  const target = resolve(STAGING, `pr-${prNumber}`);
  extractSourceViaTar(sha, target);
  linkNodeModules(target);
  buildIn(target, prNumber);
}

function aggregate(prNumber) {
  const sourceDist = resolve(STAGING, `pr-${prNumber}/dist`);
  const targetDir = resolve(AGGREGATE, `pr-${prNumber}`);
  if (!existsSync(sourceDist)) {
    throw new Error(`Build for PR #${prNumber} produced no dist/ output.`);
  }
  cpSync(sourceDist, targetDir, { recursive: true });
}

function verifyAggregate() {
  run('node', ['scripts/check-build.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      SITE_URL: `${SITE}/`,
    },
  });
}

function writeState(state) {
  if (!existsSync(dirname(STATE_FILE))) {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
  }
  const ordered = Object.fromEntries(
    Object.entries(state.previews).sort(([a], [b]) => Number(a) - Number(b)),
  );
  writeFileSync(
    STATE_FILE,
    `${JSON.stringify({ previews: ordered }, null, INDENT_SPACES)}\n`,
  );
}

/**
 * Run the build pipeline.
 *
 * @param {{
 *   prNumber: string,
 *   event: string,
 *   action: string,
 *   githubRepository: string,
 *   githubSha: string,
 *   checkoutToken: string,
 * }} context
 */
export function runBuild(context) {
  const {
    prNumber,
    event,
    action,
    githubRepository,
    githubSha,
    checkoutToken,
  } = context;

  if (!prNumber || !githubRepository || !githubSha) {
    throw new Error(
      'prNumber, githubRepository and githubSha are required in context.',
    );
  }

  const headSha = githubSha;
  // `HEAD_REPO` is captured for traceability only; the script always fetches
  // Through the base repo because GitHub exposes `pull/{N}/head` there for
  // Every PR, including fork PRs.
  void context;

  const isRemove = event === 'pull_request' && action === 'closed';
  const nextAction = isRemove ? 'remove' : 'add';

  const desired = nextState(loadState(), {
    prNumber,
    action: nextAction,
    sha: headSha,
  });

  const prNumbers = Object.keys(desired.previews).sort(
    (a, b) => Number(a) - Number(b),
  );

  console.log(
    `[build-preview-aggregate] event=${event} action=${action} → keep ${prNumbers.length} preview(s): [${prNumbers.join(', ')}]`,
  );

  // Clean staging and aggregate at the start so a previous interrupted run
  // Cannot leak artifacts.
  if (existsSync(STAGING)) {
    rmSync(STAGING, { recursive: true, force: true });
  }
  if (existsSync(AGGREGATE)) {
    rmSync(AGGREGATE, { recursive: true, force: true });
  }
  mkdirSync(STAGING, { recursive: true });
  mkdirSync(AGGREGATE, { recursive: true });

  const failures = [];
  for (const n of prNumbers) {
    try {
      const { sha } = desired.previews[n];
      if (n === prNumber) {
        console.log(`[build-preview-aggregate] building current PR #${n}`);
        buildCurrent(n);
      } else {
        console.log(
          `[build-preview-aggregate] fetching and building PR #${n} at ${sha}`,
        );
        buildOther(n, sha, { checkoutToken, githubRepository });
      }
      aggregate(n);
      console.log(`[build-preview-aggregate] PR #${n} aggregated`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[build-preview-aggregate] PR #${n} failed: ${message}`);
      failures.push(n);
    }
  }

  if (prNumbers.length > ZERO && failures.length === prNumbers.length) {
    throw new Error(
      `Every active PR failed to build (${failures.join(', ')}); refusing to deploy an empty aggregate.`,
    );
  }

  if (prNumbers.length > ZERO) {
    verifyAggregate();
  } else {
    console.log(
      '[build-preview-aggregate] no active PRs; skipping check:build',
    );
  }

  writeState(desired);
  console.log(
    `[build-preview-aggregate] wrote state with ${prNumbers.length} preview(s)`,
  );

  if (failures.length > ZERO) {
    process.exitCode = 1;
    console.error(
      `[build-preview-aggregate] ${failures.length} PR(s) failed: ${failures.join(', ')}`,
    );
  }
}

if (import.meta.main) {
  const {
    PR_NUMBER,
    EVENT,
    ACTION,
    GITHUB_REPOSITORY,
    GITHUB_SHA,
    CHECKOUT_TOKEN,
  } = process.env;
  runBuild({
    prNumber: PR_NUMBER,
    event: EVENT,
    action: ACTION,
    githubRepository: GITHUB_REPOSITORY,
    githubSha: GITHUB_SHA,
    checkoutToken: CHECKOUT_TOKEN ?? '',
  });
}
