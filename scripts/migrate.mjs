import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { stringify as toYaml } from 'yaml';

const ORIGIN = 'https://www.xedotnet.org',
  ROOT = new URL('../', import.meta.url).pathname,
  EVENTS_DIR = join(ROOT, 'src/data/events'),
  PEOPLE_DIR = join(ROOT, 'src/data/people'),
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
  assetCache = new Map();

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
    body = turndown
      .turndown(bodyHtml)
      .replaceAll(/\n{3,}/g, '\n\n')
      .trim(),
    description =
      clean(
        $('meta[name="description"]').attr('content') || article.text(),
      ).slice(0, 300) || title,
    sessions = [];
  $('article.maincontent > .row').each((_, row) => {
    const columns = $(row).children('[class*="col-"]');
    if (columns.length < 2) {
      return;
    }
    const first = columns.eq(0),
      second = columns.eq(1),
      time = clean(first.children('strong').first().text()),
      speakerText = clean(first.find('span').last().text()),
      sessionTitle = clean(second.children('strong').first().text()),
      sessionDescription = clean(second.find('p').text());
    if (!sessionTitle && !time) {
      return;
    }
    sessions.push({
      ...(time && { time }),
      speakers: speakerText
        ? speakerText.split(/\s+(?:&|e)\s+|,\s*/).filter(Boolean)
        : [],
      title: sessionTitle || 'Sessione',
      ...(sessionDescription && { description: sessionDescription }),
    });
  });

  const materialMap = new Map();
  $('article.maincontent a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href'),
      label = clean($(anchor).text());
    if (!href) {
      return;
    }
    const absolute = new URL(href, ORIGIN);
    if (
      /drive\.google|github\.com|slides|download/i.test(
        `${absolute.href} ${label}`,
      )
    ) {
      materialMap.set(absolute.href, label || 'Materiale');
    }
  });

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
      sessions,
      materials: [...materialMap].map(([materialUrl, label]) => ({
        label,
        url: materialUrl,
      })),
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
    seen = new Set();
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
      person = {
        name,
        sortName: name,
        ...(title && { title }),
        ...(image && { image }),
        roles: ['member'],
        links: externalLinks($, modal),
        published: true,
        sourceUrl: url,
      },
      frontmatter = toYaml(person, { lineWidth: 0 }).trim();
    await writeFile(
      join(PEOPLE_DIR, `${slug}.md`),
      `---\n${frontmatter}\n---\n${bio ? `\n${bio}\n` : ''}`,
    );
    report.routes.push({
      destination: `/soci/${slug}/`,
      kind: 'socio',
      source: `${url}#${slug}`,
    });
  }
  report.people = seen.size;
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
    mkdir(MEDIA_DIR, { recursive: true }),
  ]);
  const eventUrls = await discoverEventUrls();
  console.log(`Trovati ${eventUrls.length} eventi. Avvio la migrazione…`);
  await Promise.all([
    runPool(eventUrls, 6, parseEvent),
    migratePeople(),
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
