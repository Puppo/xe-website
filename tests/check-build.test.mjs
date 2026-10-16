import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const checkBuildScript = fileURLToPath(
  new URL('../scripts/check-build.mjs', import.meta.url),
);

it.each(['/', '/xe-website/'])(
  'validates titled Markdown links and linked images under %s',
  (base) => {
    const directory = mkdtempSync(join(tmpdir(), 'xe-check-build-')),
      publicUrl = `https://example.com${base}`;
    try {
      mkdirSync(join(directory, 'dist', 'media'), { recursive: true });
      writeFileSync(
        join(directory, 'dist', 'robots.txt'),
        `Sitemap: ${publicUrl}sitemap-index.xml\n`,
      );
      writeFileSync(join(directory, 'dist', 'media', 'slides.pdf'), 'fixture');
      writeFileSync(join(directory, 'dist', 'media', 'preview.png'), 'fixture');
      writeFileSync(
        join(directory, 'dist', 'llms.txt'),
        `# XE\n\n[![](${publicUrl}media/preview.png)](${publicUrl}media/slides.pdf "Slides")\n`,
      );
      const runCheck = () =>
        spawnSync(process.execPath, [checkBuildScript], {
          cwd: directory,
          encoding: 'utf8',
          env: { ...process.env, SITE_URL: publicUrl },
        });
      const valid = runCheck();
      expect(valid.status, valid.stderr).toBe(EXIT_SUCCESS);

      rmSync(join(directory, 'dist', 'media', 'slides.pdf'));
      const invalid = runCheck();
      expect(invalid.status).toBe(EXIT_FAILURE);
      expect(invalid.stderr).toContain(
        `missing destination for markdown-link=${publicUrl}media/slides.pdf`,
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  },
);
