import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { prepareDockerModel } from '../scripts/prepare-webmcp-ollama-docker.mjs';

const profile = JSON.parse(
  readFileSync(new URL('../docs/webmcp/ollama.json', import.meta.url), 'utf8'),
);
const tags = (model = profile.model, digest = profile.modelDigest) =>
  Response.json({ models: [{ name: model, digest }] });

describe('explicit Docker Ollama model preparation', () => {
  it('pulls the configured model and verifies its pinned digest without inference', async () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    const fetcher = vi.fn().mockResolvedValue(tags());
    const installed = await prepareDockerModel({ env: {}, run, fetcher });
    expect(installed.digest).toBe(profile.modelDigest);
    expect(run.mock.calls[0][0]).toBe('docker');
    expect(run.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        'compose',
        'exec',
        '-T',
        'ollama',
        'pull',
        profile.model,
      ]),
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/tags');
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects model weights that differ from the configured pin', async () => {
    await expect(
      prepareDockerModel({
        env: {},
        run: vi.fn().mockReturnValue({ status: 0 }),
        fetcher: vi.fn().mockResolvedValue(tags(profile.model, 'changed')),
      }),
    ).rejects.toThrow('digest');
  });

  it('honors an explicit alternate model and digest', async () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    await prepareDockerModel({
      env: { OLLAMA_MODEL: 'another:model', OLLAMA_MODEL_DIGEST: 'alternate' },
      run,
      fetcher: vi.fn().mockResolvedValue(tags('another:model', 'alternate')),
    });
    expect(run.mock.calls[0][1].at(-1)).toBe('another:model');
  });

  it('rejects a remote host before pulling into the local container', async () => {
    const run = vi.fn();
    await expect(
      prepareDockerModel({
        env: { OLLAMA_HOST: 'https://example.com' },
        run,
        fetcher: vi.fn(),
      }),
    ).rejects.toThrow('local Compose');
    expect(run).not.toHaveBeenCalled();
  });

  it('does not contact Ollama after a failed pull', async () => {
    const fetcher = vi.fn();
    await expect(
      prepareDockerModel({
        env: {},
        run: vi.fn().mockReturnValue({ status: 1 }),
        fetcher,
      }),
    ).rejects.toThrow('pull');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports a missing Docker executable as a setup error', async () => {
    await expect(
      prepareDockerModel({
        env: {},
        run: vi
          .fn()
          .mockReturnValue({ error: new Error('ENOENT'), status: null }),
        fetcher: vi.fn(),
      }),
    ).rejects.toThrow('Docker');
  });

  it('rejects unavailable or malformed model catalogs', async () => {
    for (const response of [
      new Response('unavailable', { status: 503 }),
      Response.json({ models: [] }),
    ]) {
      await expect(
        prepareDockerModel({
          env: {},
          run: vi.fn().mockReturnValue({ status: 0 }),
          fetcher: vi.fn().mockResolvedValue(response),
        }),
      ).rejects.toThrow();
    }
  });
});
