import { glob, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, parseDocument } from 'yaml';
import { markdownParts, replaceSessions } from './lib/speaker-enrichment.mjs';
import {
  extractLegacyMaterials,
  recoverEventMaterials,
} from './lib/legacy-materials.mjs';

const ROOT = join(import.meta.dirname, '..');

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'XeDotNet material enrichment/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

export async function enrichMaterials({
  root = ROOT,
  write = false,
  fetchPage = fetchText,
} = {}) {
  const peopleNames = new Map(),
    events = [],
    audits = [],
    warnings = [];
  for await (const path of glob('src/data/people/*.md', { cwd: root })) {
    const data = parse(
      markdownParts(await readFile(join(root, path), 'utf8')).frontmatter,
    );
    peopleNames.set(basename(path, '.md'), data.name);
  }
  for await (const path of glob('src/data/events/**/*.md', { cwd: root })) {
    const source = await readFile(join(root, path), 'utf8'),
      parts = markdownParts(source),
      data = parse(parts.frontmatter);
    if (
      (data.materials ?? []).length > 0 ||
      (data.sessions ?? []).some((session) => session.materials?.length > 0) ||
      /^#{2,3} (?:Prerequisiti|Riferimenti) —/mu.test(parts.remainder)
    )
      events.push({ path, source, ...parts, data });
  }
  let updatedEvents = 0;
  const queue = [...events];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length > 0) {
        const event = queue.shift();
        if (!event) continue;
        let evidence;
        try {
          if (!event.data.sourceUrl) throw new Error('sourceUrl assente');
          evidence = extractLegacyMaterials(
            await fetchPage(event.data.sourceUrl),
            event.data.sourceUrl,
          );
          if (evidence.length === 0)
            throw new Error('contenuto della fonte non riconosciuto');
        } catch (error) {
          warnings.push(
            `${event.path}: ${error instanceof Error ? error.message : String(error)}.`,
          );
          audits.push(
            `${event.path}: fonte non disponibile; contenuto conservato.`,
          );
          continue;
        }
        const recovered = recoverEventMaterials({
            data: event.data,
            body: event.remainder,
            evidence,
            peopleNames,
          }),
          document = parseDocument(
            replaceSessions(event.frontmatter, recovered.sessions),
          );
        if (
          JSON.stringify(event.data.materials ?? []) !==
          JSON.stringify(recovered.materials)
        )
          document.set('materials', recovered.materials);
        const unchangedData =
            JSON.stringify(event.data) === JSON.stringify(document.toJS()),
          frontmatter = unchangedData
            ? event.frontmatter
            : document.toString({ lineWidth: 0 }).trimEnd(),
          source = `---\n${frontmatter}\n---${recovered.body}`,
          changed = source !== event.source,
          assigned = recovered.sessions.flatMap(
            (session) => session.materials ?? [],
          ).length;
        warnings.push(
          ...recovered.warnings.map((warning) => `${event.path}: ${warning}`),
        );
        audits.push(
          `${event.path}: ${changed ? 'riparato' : 'invariato'}; ${assigned} risorse nelle sessioni, ${recovered.materials.length} risorse comuni o non attribuite.`,
        );
        if (changed) {
          updatedEvents += 1;
          if (write) await writeFile(join(root, event.path), source);
        }
      }
    }),
  );
  const report = [
    '# Verifica dei materiali dell’archivio',
    '',
    `Modalità: ${write ? 'scrittura' : 'simulazione'}`,
    '',
    `- Eventi esaminati: ${events.length}`,
    `- Eventi modificati: ${updatedEvents}`,
    '',
    '## Verifica degli eventi',
    '',
    ...audits.sort().map((entry) => `- ${entry}`),
    '',
    '## Fonti non disponibili e attribuzioni da verificare',
    '',
    ...(warnings.length > 0
      ? warnings.sort().map((entry) => `- ${entry}`)
      : ['- Nessuna']),
    '',
  ].join('\n');
  return { report, updatedEvents, warnings, audits };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { report } = await enrichMaterials({
    write: process.argv.includes('--write'),
  });
  console.log(report);
}
