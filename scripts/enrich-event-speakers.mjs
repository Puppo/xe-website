import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import {
  canonicalAssetUrl,
  chooseKnownProfileUrl,
  extractLegacySpeakerCandidates,
  isOrganizationSpeaker,
  markdownParts,
  normalizeSpeakerName,
  replaceSpeakerScalars,
  safeName,
  selectImageCandidate
} from './lib/speaker-enrichment.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EVENTS_DIR = join(ROOT, 'src/data/events');
const PEOPLE_DIR = join(ROOT, 'src/data/people');
const MEDIA_DIR = join(ROOT, 'public/media');
const REPORT_PATH = join(ROOT, 'SPEAKER-IMPORT-REPORT.md');
const WRITE = process.argv.includes('--write');
const CONCURRENCY = 6;

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  }));
  return nested.flat();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'XeDotNet speaker enrichment/1.0' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function runPool(items, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await worker(item);
    }
  }));
}

function parseMarkdown(source) {
  const parts = markdownParts(source);
  return { ...parts, data: parse(parts.frontmatter) };
}

function renderMarkdown(data, remainder) {
  return `---\n${stringify(data, { lineWidth: 0 }).trim()}\n---${remainder}`;
}

function uniqueSlug(name, occupiedIds) {
  const base = safeName(name) || 'speaker';
  let slug = base;
  let suffix = 2;
  while (occupiedIds.has(slug)) slug = `${base}-${suffix++}`;
  occupiedIds.add(slug);
  return slug;
}

function mediaFilename(url) {
  const parsed = new URL(url);
  const original = decodeURIComponent(basename(parsed.pathname));
  const parentId = parsed.pathname.split('/').filter(Boolean).at(-2)?.match(/^\d+$/)?.[0];
  const extension = extname(original).toLowerCase() || '.bin';
  const stem = safeName(original.slice(0, -extension.length)) || 'speaker';
  return `${parentId ? `${parentId}-` : ''}${stem}${extension}`;
}

async function downloadImage(url) {
  const canonical = canonicalAssetUrl(url);
  const filename = mediaFilename(canonical);
  if (!WRITE) return `/media/${filename}`;
  const response = await fetch(canonical, {
    headers: { 'user-agent': 'XeDotNet speaker enrichment/1.0' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${canonical}`);
  await writeFile(join(MEDIA_DIR, filename), Buffer.from(await response.arrayBuffer()));
  return `/media/${filename}`;
}

const eventFiles = await markdownFiles(EVENTS_DIR);
const personFiles = await markdownFiles(PEOPLE_DIR);
const events = await Promise.all(eventFiles.map(async (path) => ({ path, ...parseMarkdown(await readFile(path, 'utf8')) })));
const people = await Promise.all(personFiles.map(async (path) => ({
  id: basename(path, '.md').replaceAll('.', ''),
  path,
  ...parseMarkdown(await readFile(path, 'utf8'))
})));
const occupiedIds = new Set(people.map(({ id }) => id));
const peopleByName = new Map(people.map((person) => [normalizeSpeakerName(person.data.name), person]));
const sourcePageByName = new Map();
const uniqueHumanNames = new Map();

for (const event of events) {
  for (const session of event.data.sessions ?? []) {
    for (const speaker of session.speakers ?? []) {
      if (typeof speaker !== 'string' || isOrganizationSpeaker(speaker)) continue;
      const key = normalizeSpeakerName(speaker);
      uniqueHumanNames.set(key, speaker);
      if (!sourcePageByName.has(key)) sourcePageByName.set(key, event.data.sourceUrl);
    }
  }
}

const candidatesByName = new Map();
const warnings = [];
await runPool(events.filter(({ data }) => data.sourceUrl), async (event) => {
  try {
    const html = await fetchText(event.data.sourceUrl);
    for (const candidate of extractLegacySpeakerCandidates(html, event.data.sourceUrl)) {
      const key = normalizeSpeakerName(candidate.name);
      const candidates = candidatesByName.get(key) ?? [];
      candidates.push(candidate);
      candidatesByName.set(key, candidates);
    }
  } catch (error) {
    warnings.push(`${event.data.sourceUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

const referencesByName = new Map();
const created = [];
const reused = [];
const importedImages = [];
const missingImages = [];
const ambiguousImages = [];

await mkdir(MEDIA_DIR, { recursive: true });

for (const [key, name] of [...uniqueHumanNames].sort((a, b) => a[1].localeCompare(b[1], 'it'))) {
  let person = peopleByName.get(key);
  if (!person) {
    const id = uniqueSlug(name, occupiedIds);
    person = {
      id,
      path: join(PEOPLE_DIR, `${id}.md`),
      frontmatter: '',
      remainder: '\n',
      data: {
        name,
        sortName: name,
        roles: ['speaker'],
        links: [],
        published: true,
        sourceUrl: sourcePageByName.get(key)
      }
    };
    people.push(person);
    peopleByName.set(key, person);
    created.push(name);
  } else {
    if (!person.data.roles.includes('speaker')) person.data.roles.push('speaker');
    person.data.profileUrl ??= chooseKnownProfileUrl(person.data.links);
    reused.push(name);
  }

  const candidates = candidatesByName.get(key) ?? [];
  const imageUrl = selectImageCandidate(candidates);
  if (!person.data.image && imageUrl) {
    try {
      person.data.image = await downloadImage(imageUrl);
      importedImages.push(name);
    } catch (error) {
      warnings.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
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
  const frontmatter = replaceSpeakerScalars(event.frontmatter, referencesByName);
  if (frontmatter === event.frontmatter) continue;
  updatedEvents += 1;
  if (WRITE) await writeFile(event.path, `---\n${frontmatter}\n---${event.remainder}`);
}

for (const person of people) {
  const source = renderMarkdown(person.data, person.remainder);
  if (WRITE) await writeFile(person.path, source);
}

const report = [
  '# Speaker import report',
  '',
  `Mode: ${WRITE ? 'write' : 'dry-run'}`,
  '',
  `- Event files updated: ${updatedEvents}`,
  `- Existing profiles reused: ${reused.length}`,
  `- Speaker-only profiles created: ${created.length}`,
  `- Photos imported: ${importedImages.length}`,
  `- Missing photos: ${missingImages.length}`,
  `- Ambiguous photos: ${ambiguousImages.length}`,
  `- Legacy page warnings: ${warnings.length}`,
  '',
  '## Created profiles',
  '',
  ...(created.length ? created.map((name) => `- ${name}`) : ['- None']),
  '',
  '## Imported photos',
  '',
  ...(importedImages.length ? importedImages.map((name) => `- ${name}`) : ['- None']),
  '',
  '## Missing photos (initials fallback)',
  '',
  ...(missingImages.length ? missingImages.map((name) => `- ${name}`) : ['- None']),
  '',
  '## Ambiguous photos (initials fallback)',
  '',
  ...(ambiguousImages.length ? ambiguousImages.map((name) => `- ${name}`) : ['- None']),
  '',
  '## Untouched organization entries',
  '',
  '- 1nn0va',
  '- XE',
  '',
  '## Warnings',
  '',
  ...(warnings.length ? warnings.sort().map((warning) => `- ${warning}`) : ['- None']),
  ''
].join('\n');

if (WRITE) await writeFile(REPORT_PATH, report);
console.log(report);
