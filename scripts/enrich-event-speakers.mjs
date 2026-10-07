import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import {
  mergeSessions,
  recoverLegacySessions,
} from './lib/legacy-sessions.mjs';
import {
  canonicalPersonSlug,
  personIdFromFilename,
} from '../src/lib/person-slugs.mjs';
import {
  canonicalAssetUrl,
  createPeopleNameIndex,
  matchSpeaker,
  replaceSessions,
  extractLegacySpeakerCandidates,
  isOrganizationSpeaker,
  markdownParts,
  normalizeSpeakerName,
  replaceSpeakerScalars,
  safeName,
  selectImageCandidate,
} from './lib/speaker-enrichment.mjs';

const ROOT = join(import.meta.dirname, '..'),
  CONCURRENCY = 6;

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }),
    nested = await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return markdownFiles(path);
        }
        return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
      }),
    );
  return nested.flat();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'XeDotNet speaker enrichment/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function runPool(items, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) {
          await worker(item);
        }
      }
    }),
  );
}

function parseMarkdown(source) {
  const parts = markdownParts(source);
  return { ...parts, data: parse(parts.frontmatter) };
}

function renderMarkdown(data, remainder) {
  return `---\n${stringify(data, { lineWidth: 0 }).trim()}\n---${remainder}`;
}

function uniqueSlug(name, occupiedIds) {
  const base = canonicalPersonSlug(name) || 'speaker';
  let slug = base,
    suffix = 2;
  while (occupiedIds.has(slug)) {
    slug = `${base}-${suffix++}`;
  }
  occupiedIds.add(slug);
  return slug;
}

function mediaFilename(url) {
  const parsed = new URL(url),
    original = decodeURIComponent(basename(parsed.pathname)),
    parentId = parsed.pathname
      .split('/')
      .filter(Boolean)
      .at(-2)
      ?.match(/^\d+$/)?.[0],
    extension = extname(original).toLowerCase() || '.bin',
    stem = safeName(original.slice(0, -extension.length)) || 'speaker';
  return `${parentId ? `${parentId}-` : ''}${stem}${extension}`;
}

async function downloadImage(url, write, mediaDirectory) {
  const canonical = canonicalAssetUrl(url),
    filename = mediaFilename(canonical);
  if (!write) {
    return `/media/${filename}`;
  }
  const response = await fetch(canonical, {
    headers: { 'user-agent': 'XeDotNet speaker enrichment/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${canonical}`);
  }
  await writeFile(
    join(mediaDirectory, filename),
    Buffer.from(await response.arrayBuffer()),
  );
  return `/media/${filename}`;
}

export async function enrichSpeakers({
  root = ROOT,
  write = false,
  fetchPage = fetchText,
} = {}) {
  const EVENTS_DIR = join(root, 'src/data/events'),
    PEOPLE_DIR = join(root, 'src/data/people'),
    MEDIA_DIR = join(root, 'public/media');
  const eventFiles = await markdownFiles(EVENTS_DIR),
    personFiles = await markdownFiles(PEOPLE_DIR),
    events = await Promise.all(
      eventFiles.map(async (path) => ({
        path,
        ...parseMarkdown(await readFile(path, 'utf8')),
      })),
    ),
    people = await Promise.all(
      personFiles.map(async (path) => ({
        id: personIdFromFilename(basename(path)),
        path,
        ...parseMarkdown(await readFile(path, 'utf8')),
      })),
    ),
    occupiedIds = new Set(people.map(({ id }) => id)),
    peopleByName = createPeopleNameIndex(people),
    sourcePageByName = new Map(),
    uniqueHumanNames = new Map();

  const candidatesByName = new Map(),
    warnings = [],
    audits = [],
    peopleNames = new Map(
      people.map((person) => [person.id, person.data.name]),
    );
  for (const event of events.filter(({ data }) => !data.sourceUrl))
    warnings.push(
      `${event.path}: sourceUrl assente, verifica non disponibile.`,
    );
  await runPool(
    events.filter(({ data }) => data.sourceUrl),
    async (event) => {
      try {
        const html = await fetchPage(event.data.sourceUrl),
          recovered = await recoverLegacySessions(
            html,
            event.data.sourceUrl,
            event.data.title,
            fetchPage,
          );
        warnings.push(...recovered.warnings);
        const before = event.data.sessions ?? [],
          merged = mergeSessions(before, recovered.sessions, peopleNames);
        event.data.sessions = merged;
        audits.push(
          `${event.data.sourceUrl}: ${recovered.kind}; ${before.length} → ${merged.length} sessioni${recovered.warnings.length > 0 ? '; verifica incompleta' : ''}.`,
        );
        const titles = new Set();
        for (const session of before) {
          const key = `${normalizeSpeakerName(session.title)}|${session.time ?? ''}`;
          if (titles.has(key))
            warnings.push(
              `${event.data.sourceUrl}: titolo sessione ambiguo: ${session.title}`,
            );
          titles.add(key);
        }
        for (const candidate of extractLegacySpeakerCandidates(
          html,
          event.data.sourceUrl,
        )) {
          const key = normalizeSpeakerName(candidate.name),
            candidates = candidatesByName.get(key) ?? [];
          candidates.push(candidate);
          candidatesByName.set(key, candidates);
        }
      } catch (error) {
        audits.push(
          `${event.data.sourceUrl}: fonte non disponibile; sessioni conservate.`,
        );
        warnings.push(
          `${event.data.sourceUrl}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  for (const event of events) {
    for (const session of event.data.sessions ?? []) {
      for (const speaker of session.speakers ?? []) {
        if (typeof speaker !== 'string' || isOrganizationSpeaker(speaker))
          continue;
        const key = normalizeSpeakerName(speaker);
        uniqueHumanNames.set(key, speaker);
        if (!sourcePageByName.has(key))
          sourcePageByName.set(key, event.data.sourceUrl);
      }
    }
  }

  const referencesByName = new Map(),
    created = [],
    reused = [],
    importedImages = [],
    missingImages = [],
    ambiguousImages = [];

  if (write) await mkdir(MEDIA_DIR, { recursive: true });

  for (const [key, name] of [...uniqueHumanNames].sort((a, b) =>
    a[1].localeCompare(b[1], 'it'),
  )) {
    const match = matchSpeaker(name, peopleByName);
    if (match.kind === 'ambiguous') {
      warnings.push(
        `${name}: corrispondenza ambigua (${match.ids.join(', ')}).`,
      );
      continue;
    }
    let { person } = match;
    if (person) {
      reused.push(name);
    } else {
      const id = uniqueSlug(name, occupiedIds);
      person = {
        id,
        path: join(PEOPLE_DIR, `${id}.md`),
        frontmatter: '',
        remainder: '\n',
        data: {
          name,
          sortName: name,
          links: [],
          published: true,
          sourceUrl: sourcePageByName.get(key),
        },
      };
      people.push(person);
      peopleByName.set(key, [person]);
      created.push(name);
    }

    const candidates = candidatesByName.get(key) ?? [],
      imageUrl = selectImageCandidate(candidates);
    if (!person.data.image && imageUrl) {
      try {
        person.data.image = await downloadImage(imageUrl, write, MEDIA_DIR);
        importedImages.push(name);
      } catch (error) {
        warnings.push(
          `${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
        missingImages.push(name);
      }
    } else if (!person.data.image && candidates.length > 0) {
      ambiguousImages.push(name);
    } else if (!person.data.image) {
      missingImages.push(name);
    }
    referencesByName.set(key, person.id);
  }

  let updatedEvents = 0;
  for (const event of events) {
    const frontmatter = replaceSpeakerScalars(
      replaceSessions(event.frontmatter, event.data.sessions ?? []),
      referencesByName,
    );
    if (frontmatter === event.frontmatter) {
      continue;
    }
    updatedEvents += 1;
    if (write) {
      await writeFile(event.path, `---\n${frontmatter}\n---${event.remainder}`);
    }
  }

  for (const person of people) {
    const source = renderMarkdown(person.data, person.remainder);
    if (write) {
      const original = person.frontmatter
        ? `---\n${person.frontmatter}\n---${person.remainder}`
        : undefined;
      if (
        !person.frontmatter ||
        JSON.stringify(parse(person.frontmatter)) !==
          JSON.stringify(person.data)
      ) {
        if (source !== original) await writeFile(person.path, source);
      }
    }
  }

  const report = [
    '# Verifica delle associazioni tra eventi e speaker',
    '',
    `Modalità: ${write ? 'scrittura' : 'simulazione'}`,
    '',
    `- Eventi esaminati: ${events.length}`,
    `- Eventi modificati: ${updatedEvents}`,
    `- Profili riutilizzati: ${reused.length}`,
    `- Profili creati: ${created.length}`,
    `- Foto importate: ${importedImages.length}`,
    '',
    '## Profili creati',
    '',
    ...(created.length > 0
      ? created.map((name) => `- ${name}`)
      : ['- Nessuno']),
    '',
    '## Verifica degli eventi',
    '',
    ...audits.sort().map((entry) => `- ${entry}`),
    '',
    '## Fonti non disponibili e corrispondenze da verificare',
    '',
    ...(warnings.length > 0
      ? warnings.sort().map((warning) => `- ${warning}`)
      : ['- Nessuna']),
    '',
    '## Foto mancanti o ambigue (fallback con iniziali)',
    '',
    ...[...missingImages, ...ambiguousImages].sort().map((name) => `- ${name}`),
    '',
  ].join('\n');
  return { report, updatedEvents, created, warnings, audits };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { report } = await enrichSpeakers({
    write: process.argv.includes('--write'),
  });
  console.log(report);
}
