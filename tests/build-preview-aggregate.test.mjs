import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, nextState } from '../scripts/build-preview-aggregate.mjs';

const stateDir = mkdtempSync(join(tmpdir(), 'preview-state-'));
const stateFile = join(stateDir, 'state.json');

beforeEach(() => {
  rmSync(stateFile, { force: true });
});

afterEach(() => {
  rmSync(stateFile, { force: true });
});

describe('loadState', () => {
  it('returns an empty state when the file does not exist', () => {
    expect(loadState(stateFile)).toEqual({ previews: {} });
  });

  it('parses a populated state file', () => {
    writeFileSync(
      stateFile,
      JSON.stringify({
        previews: {
          123: { sha: 'abc1234' },
          124: { sha: 'def5678' },
        },
      }),
    );
    expect(loadState(stateFile)).toEqual({
      previews: {
        123: { sha: 'abc1234' },
        124: { sha: 'def5678' },
      },
    });
  });

  it('throws on a malformed state file', () => {
    writeFileSync(stateFile, '{ not valid json');
    expect(() => loadState(stateFile)).toThrow(/Failed to parse/u);
  });

  it('falls back to an empty state when the file has no previews key', () => {
    writeFileSync(stateFile, JSON.stringify({}));
    expect(loadState(stateFile)).toEqual({ previews: {} });
  });
});

describe('nextState', () => {
  it('adds a new preview entry on add', () => {
    const state = { previews: {} };
    const next = nextState(state, {
      prNumber: '123',
      action: 'add',
      sha: 'abc1234',
    });
    expect(next).toEqual({
      previews: { 123: { sha: 'abc1234' } },
    });
    // Original state is unchanged (pure function).
    expect(state).toEqual({ previews: {} });
  });

  it('updates an existing preview SHA on add', () => {
    const state = { previews: { 123: { sha: 'old' } } };
    const next = nextState(state, {
      prNumber: '123',
      action: 'add',
      sha: 'new',
    });
    expect(next.previews['123'].sha).toBe('new');
  });

  it('removes the preview entry on remove', () => {
    const state = {
      previews: {
        123: { sha: 'abc' },
        124: { sha: 'def' },
      },
    };
    const next = nextState(state, {
      prNumber: '123',
      action: 'remove',
      sha: 'ignored',
    });
    expect(next).toEqual({ previews: { 124: { sha: 'def' } } });
    expect(state.previews['123']).toEqual({ sha: 'abc' });
  });

  it('is a no-op when removing a PR that is not tracked', () => {
    const state = { previews: { 123: { sha: 'abc' } } };
    const next = nextState(state, {
      prNumber: '999',
      action: 'remove',
      sha: 'ignored',
    });
    expect(next).toEqual({ previews: { 123: { sha: 'abc' } } });
  });
});
