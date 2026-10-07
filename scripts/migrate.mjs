import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { parseArgs } from 'node:util';
import { canonicalPersonSlug } from '../src/lib/person-slugs.mjs';
import { membershipInputSchema, personSchema } from '../src/content-schemas.ts';
import { parse, stringify as toYaml } from 'yaml';
import {
  mergeSessions,
  recoverLegacySessions,
} from './lib/legacy-sessions.mjs';
import {
  extractLegacyMaterials,
  recoverEventMaterials,
} from './lib/legacy-materials.mjs';
import {
  createPeopleNameIndex,
  matchSpeaker,
  markdownParts,
  normalizeSpeakerName,
} from './lib/speaker-enrichment.mjs';

const { values } = parseArgs({
  options: { 'membership-year': { type: 'string' } },
});
const membershipYear = values['membership-year'];
if (!membershipYear || !/^\d{4}$/u.test(membershipYear)) {
  throw new Error(
    'La migrazione richiede --membership-year=YYYY (quattro cifre).',
  );
}

const ORIGIN = 'https://www.xedotnet.org',
  ROOT = new URL('../', import.meta.url).pathname,
  EVENTS_DIR = join(ROOT, 'src/data/events'),
  PEOPLE_DIR = join(ROOT, 'src/data/people'),
  MEMBERSHIPS_DIR = join(ROOT, 'src/data/memberships'),
  MEDIA_DIR = join(ROOT, 'public/media'),
  years = Array.from({ length: 12 }, (_, index) => 2015 + index),
  turndown = new TurndownService({
    bulletListMarker: '-',
    headingStyle: 'atx',
  }),
  report = {
    eventCounts: {},
    missingAssets: [],
    people: 0,
    routes: [],
    warnings: [],
  },
  assetCache = new Map(),
  peopleByName = new Map(),
  occupiedPersonIds = new Set();

turndown.addRule('removeLayout', {
  filter: ['script', 'style', 'iframe'],
  replacement: () => '',
});

function clean(value = '') {
  return value.replaceAll('\xA0', ' ').replaceAll(/\s+/g, ' ').trim();
}

function slugFromUrl(url) {
  return new URL(url, ORIGIN).pathname.split('/').filter(Boolean).at(-1);
}

function safeName(value) {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

async function fetchResponse(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'XeDotNet Astro migration/1.0' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response;
}

async function fetchText(url) {
  return (await fetchResponse(url)).text();
}

async function saveAsset(source, preferredFilename) {
  if (!source || source.startsWith('data:')) {
    return undefined;
  }
  const url = new URL(source.replace(/^~\//, '/'), ORIGIN);
  if (url.origin !== ORIGIN) {
    return source;
  }
  url.search = '';
  if (assetCache.has(url.href)) {
    return assetCache.get(url.href);
  }
  const pathParts = url.pathname.split('/').filter(Boolean),
    original = decodeURIComponent(basename(url.pathname)),
    parentId = pathParts.at(-2)?.match(/^\d+$/)?.[0],
    extension = extname(original).toLowerCase(),
    stem =
      safeName(original.slice(0, extension ? -extension.length : undefined)) ||
      'asset',
    filename =
      preferredFilename ||
      `${parentId ? `${parentId}-` : ''}${stem}${extension || '.bin'}`,
    publicPath = `/media/${filename}`;
  assetCache.set(url.href, publicPath);
  try {
    const response = await fetchResponse(url);
    await writeFile(
      join(MEDIA_DIR, filename),
      Buffer.from(await response.arrayBuffer()),
    );
    return publicPath;
  } catch (error) {
    report.missingAssets.push(`${url.href} — ${error.message}`);
    return;
  }
}

function dateFromItalian(value) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) {
    return undefined;
  }
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

async function localizeImages($, root) {
  for (const element of root.find('img')) {
    const image = $(element),
      local = await saveAsset(image.attr('src'));
    if (local) {
      image.attr('src', local);
    }
    image.removeAttr('style class height width');
    if (!image.attr('alt')) {
      image.attr('alt', '');
    }
  }
}

async function localizeMediaLinks($, root) {
  for (const element of root.find('a[href]')) {
    const link = $(element),
      href = link.attr('href');
    if (!href) {
      continue;
    }
    const url = new URL(href, ORIGIN);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/media/')) {
      continue;
    }
    const local = await saveAsset(url.href);
    if (local) {
      link.attr('href', local);
    }
  }
}

function eventDetails($) {
  const details = {};
  $('.sidebar table tr').each((_, row) => {
    const key = clean($(row).find('th').text()).replace(':', '').toLowerCase(),
      valueCell = $(row).find('td');
    details[key] = {
      text: clean(valueCell.text()),
      url: valueCell.find('a[href]').attr('href'),
    };
  });
  return details;
}

async function parseEvent(url) {
  const html = await fetchText(url),
    $ = cheerio.load(html),
    slug = slugFromUrl(url),
    title =
      clean($('.pagetitle h1').first().text()) || clean($('h1').first().text()),
    details = eventDetails($),
    date = dateFromItalian(
      details.data?.text || clean($('.pagetitle .subtitle').text()),
    );
  if (!title || !date) {
    throw new Error(`Titolo o data mancanti in ${url}`);
  }

  const article = $('article.maincontent').first().clone();
  article
    .find('h2')
    .filter((_, element) => /sessioni/i.test(clean($(element).text())))
    .nextAll()
    .remove();
  article
    .find('h2')
    .filter((_, element) => /sessioni/i.test(clean($(element).text())))
    .remove();
  article.find('.row').remove();
  await localizeImages($, article);
  await localizeMediaLinks($, article);
  const bodyHtml = article.html() || '',
    legacyBody = turndown
      .turndown(bodyHtml)
      .replaceAll(/\n{3,}/g, '\n\n')
      .trim(),
    description =
      clean(
        $('meta[name="description"]').attr('content') || article.text(),
      ).slice(0, 300) || title,
    recovered = await recoverLegacySessions(html, url, title, fetchText),
    existingPath = join(EVENTS_DIR, date.slice(0, 4), `${date}-${slug}.md`);
  let existingSessions = [],
    existingMaterials = [];
  try {
    const existing = parse(
      markdownParts(await readFile(existingPath, 'utf8')).frontmatter,
    );
    existingSessions = existing.sessions ?? [];
    existingMaterials = existing.materials ?? [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const knownNames = new Map(
      [...peopleByName.values()]
        .flat()
        .map((person) => [person.id, person.data.name]),
    ),
    sessions = mergeSessions(existingSessions, recovered.sessions, knownNames);
  report.warnings.push(...recovered.warnings);
  for (const session of sessions) {
    session.speakers ??= [];
    for (let index = 0; index < session.speakers.length; index += 1) {
      const name = session.speakers[index];
      if (typeof name !== 'string') continue;
      const match = matchSpeaker(name, peopleByName);
      if (match.kind === 'organization') continue;
      if (match.kind === 'ambiguous') {
        report.warnings.push(
          `${url}: speaker ambiguo ${name} (${match.ids.join(', ')}).`,
        );
        continue;
      }
      let { person } = match;
      if (!person) {
        const base = canonicalPersonSlug(name);
        let id = base,
          suffix = 2;
        while (occupiedPersonIds.has(id)) id = `${base}-${suffix++}`;
        occupiedPersonIds.add(id);
        person = {
          id,
          data: personSchema.parse({
            name,
            sortName: name,
            links: [],
            published: true,
            sourceUrl: url,
          }),
        };
        peopleByName.set(normalizeSpeakerName(name), [person]);
        await writeFile(
          join(PEOPLE_DIR, `${id}.md`),
          `---\n${toYaml(person.data, { lineWidth: 0 }).trim()}\n---\n`,
        );
      }
      session.speakers[index] = { person: person.id };
    }
  }

  const materialRecovery = recoverEventMaterials({
      data: { sessions, materials: existingMaterials, sourceUrl: url },
      body: legacyBody,
      evidence: extractLegacyMaterials(html, url),
      peopleNames: new Map(
        [...peopleByName.values()]
          .flat()
          .map((person) => [person.id, person.data.name]),
      ),
    }),
    { body } = materialRecovery;
  report.warnings.push(
    ...materialRecovery.warnings.map((warning) => `${url}: ${warning}`),
  );

  const registrationWidget = $('.sidebar .widget')
    .filter((_, element) =>
      /iscriviti all.evento/i.test(clean($(element).text())),
    )
    .first();
  let registrationUrl = registrationWidget.find('a[href^="http"]').attr('href');
  if (!registrationUrl) {
    registrationUrl = $(
      'article.maincontent a[href*="eventbrite"], article.maincontent a[href*="sessionize"]',
    )
      .first()
      .attr('href');
  }
  if (registrationWidget.length > 0 && !registrationUrl) {
    report.warnings.push(
      `${url}: iscrizione originariamente interna, serve un nuovo URL esterno.`,
    );
  }

  const firstBodyImage = article.find('img[src]').first().attr('src'),
    venueText = details.location?.text,
    venueUrl = details.location?.url
      ? new URL(details.location.url, ORIGIN).href
      : undefined,
    data = {
      title,
      description,
      date,
      ...(details.tipo?.text && { eventType: details.tipo.text }),
      ...(venueText && {
        venue: {
          name: venueText,
          ...(venueUrl && venueUrl !== `${ORIGIN}/#` && { url: venueUrl }),
          online: /virtual|online/i.test(venueText),
        },
      }),
      ...(firstBodyImage && { image: firstBodyImage }),
      sessions: materialRecovery.sessions,
      materials: materialRecovery.materials,
      ...(registrationUrl && {
        registration: {
          label: 'Iscriviti all’evento',
          url: new URL(registrationUrl, ORIGIN).href,
        },
      }),
      sourceUrl: url,
      draft: false,
    },
    frontmatter = toYaml(data, { lineWidth: 0 }).trim(),
    year = date.slice(0, 4),
    yearDirectory = join(EVENTS_DIR, year);
  await mkdir(yearDirectory, { recursive: true });
  await writeFile(
    join(yearDirectory, `${date}-${slug}.md`),
    `---\n${frontmatter}\n---\n\n${body || description}\n`,
  );
  report.routes.push({
    destination: `/eventi/${slug}/`,
    kind: 'evento',
    source: url,
    year: date.slice(0, 4),
  });
  report.eventCounts[date.slice(0, 4)] =
    (report.eventCounts[date.slice(0, 4)] || 0) + 1;
}

function externalLinks($, root) {
  const unique = new Map();
  root.find('a[href^="http"]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!href) {
      return;
    }
    try {
      const url = new URL(href),
        label = url.hostname.replace(/^www\./, '');
      unique.set(url.href, { label, url: url.href });
    } catch {
      // Ignore unparseable hrefs — only valid URLs are kept above.
    }
  });
  return [...unique.values()];
}

async function migratePeople() {
  const url = `${ORIGIN}/soci/`,
    $ = cheerio.load(await fetchText(url)),
    cards = $(
      '.cards > .row > [itemscope][itemtype*="Person"], .cards > [itemscope][itemtype*="Person"]',
    ).toArray(),
    seen = new Set(),
    importedMembers = new Set();
  for (const cardElement of cards) {
    const card = $(cardElement),
      modal = card.find('.modal[id^="popup_"]').first(),
      slug =
        modal.attr('id')?.replace(/^popup_/, '') ||
        safeName(clean(card.find('[itemprop="name"]').first().text()));
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    const name =
      clean(
        modal.find('.modal-title').clone().children().remove().end().text(),
      ) || clean(card.find('[itemprop="name"]').first().text());
    if (!name) {
      continue;
    }
    const title = clean(modal.find('[itemprop="jobTitle"]').first().text()),
      descriptionRoot = modal.find('[itemprop="description"]').first(),
      bio = turndown.turndown(descriptionRoot.html() || '').trim(),
      imageSource =
        modal.find('.modal-body img').first().attr('src') ||
        card.find('img').first().attr('src'),
      image =
        imageSource && !/no_photo/i.test(imageSource)
          ? await saveAsset(imageSource)
          : undefined,
      id = canonicalPersonSlug(slug),
      person = {
        name,
        sortName: name,
        ...(title && { title }),
        ...(image && { image }),
        links: externalLinks($, modal),
        published: true,
        sourceUrl: url,
      },
      frontmatter = toYaml(personSchema.parse(person), { lineWidth: 0 }).trim();
    await writeFile(
      join(PEOPLE_DIR, `${id}.md`),
      `---\n${frontmatter}\n---\n${bio ? `\n${bio}\n` : ''}`,
    );
    importedMembers.add(id);
    report.routes.push({
      destination: `/soci/${id}/`,
      kind: 'socio',
      source: `${url}#${slug}`,
    });
  }
  const membership = membershipInputSchema.parse({
    members: [...importedMembers].sort(),
  });
  await writeFile(
    join(MEMBERSHIPS_DIR, `${membershipYear}.json`),
    `${JSON.stringify(membership, null, 2)}\n`,
  );
  report.people = importedMembers.size;
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  async function consume() {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        await worker(item);
      } catch (error) {
        report.warnings.push(`${item}: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, consume));
}

async function discoverEventUrls() {
  const pages = [
      `${ORIGIN}/eventi/`,
      ...years.map((year) => `${ORIGIN}/eventi/${year}`),
    ],
    urls = new Set();
  for (const page of pages) {
    const $ = cheerio.load(await fetchText(page));
    $('a[href^="/eventi/"]').each((_, anchor) => {
      const absolute = new URL($(anchor).attr('href'), ORIGIN),
        slug = slugFromUrl(absolute);
      if (slug && !/^\d{4}$/.test(slug) && absolute.pathname !== '/eventi/') {
        urls.add(absolute.href);
      }
    });
  }
  return [...urls].sort();
}

async function main() {
  await Promise.all([
    mkdir(EVENTS_DIR, { recursive: true }),
    mkdir(PEOPLE_DIR, { recursive: true }),
    mkdir(MEMBERSHIPS_DIR, { recursive: true }),
    mkdir(MEDIA_DIR, { recursive: true }),
  ]);
  const eventUrls = await discoverEventUrls();
  console.log(`Trovati ${eventUrls.length} eventi. Avvio la migrazione…`);
  await migratePeople();
  const profiles = await Promise.all(
    (await readdir(PEOPLE_DIR))
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => ({
        id: file.slice(0, -3),
        data: parse(
          markdownParts(await readFile(join(PEOPLE_DIR, file), 'utf8'))
            .frontmatter,
        ),
      })),
  );
  for (const [key, matches] of createPeopleNameIndex(profiles))
    peopleByName.set(key, matches);
  for (const person of profiles) occupiedPersonIds.add(person.id);
  await Promise.all([
    runPool(eventUrls, 6, parseEvent),
    saveAsset('/media/1139/statutoxedotnet.pdf', 'statuto-xedotnet.pdf'),
    saveAsset('/media/1184/sessionize-logo.png'),
    saveAsset('/media/1223/logo_eventitech_200.png'),
    saveAsset('/media/1095/xedotnet_04.jpg'),
  ]);
  console.log(
    `Migrazione completata: ${eventUrls.length} eventi, ${report.people} soci.`,
  );
}

await main();
