import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { stringify as toYaml } from 'yaml';

const ORIGIN = 'https://www.xedotnet.org';
const ROOT = new URL('../', import.meta.url).pathname;
const EVENTS_DIR = join(ROOT, 'src/data/events');
const PEOPLE_DIR = join(ROOT, 'src/data/people');
const MEDIA_DIR = join(ROOT, 'public/media');
const REPORT_PATH = join(ROOT, 'MIGRATION-REPORT.md');
const years = Array.from({ length: 12 }, (_, index) => 2015 + index);
const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
const report = { routes: [], missingAssets: [], warnings: [], eventCounts: {}, people: 0 };
const assetCache = new Map();

turndown.addRule('removeLayout', {
  filter: ['script', 'style', 'iframe'],
  replacement: () => ''
});

function clean(value = '') {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugFromUrl(url) {
  return new URL(url, ORIGIN).pathname.split('/').filter(Boolean).at(-1);
}

function safeName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function fetchResponse(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'XeDotNet Astro migration/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response;
}

async function fetchText(url) {
  return (await fetchResponse(url)).text();
}

async function saveAsset(source, preferredFilename) {
  if (!source || source.startsWith('data:')) return undefined;
  const url = new URL(source.replace(/^~\//, '/'), ORIGIN);
  if (url.origin !== ORIGIN) return source;
  url.search = '';
  if (assetCache.has(url.href)) return assetCache.get(url.href);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const original = decodeURIComponent(basename(url.pathname));
  const parentId = pathParts.at(-2)?.match(/^\d+$/)?.[0];
  const extension = extname(original).toLowerCase();
  const stem = safeName(original.slice(0, extension ? -extension.length : undefined)) || 'asset';
  const filename = preferredFilename || `${parentId ? `${parentId}-` : ''}${stem}${extension || '.bin'}`;
  const publicPath = `/media/${filename}`;
  assetCache.set(url.href, publicPath);
  try {
    const response = await fetchResponse(url);
    await writeFile(join(MEDIA_DIR, filename), Buffer.from(await response.arrayBuffer()));
    return publicPath;
  } catch (error) {
    report.missingAssets.push(`${url.href} — ${error.message}`);
    return undefined;
  }
}

function dateFromItalian(value) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return undefined;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

async function localizeImages($, root) {
  for (const element of root.find('img').toArray()) {
    const image = $(element);
    const local = await saveAsset(image.attr('src'));
    if (local) image.attr('src', local);
    image.removeAttr('style class height width');
    if (!image.attr('alt')) image.attr('alt', '');
  }
}

async function localizeMediaLinks($, root) {
  for (const element of root.find('a[href]').toArray()) {
    const link = $(element);
    const href = link.attr('href');
    if (!href) continue;
    const url = new URL(href, ORIGIN);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/media/')) continue;
    const local = await saveAsset(url.href);
    if (local) link.attr('href', local);
  }
}

function eventDetails($) {
  const details = {};
  $('.sidebar table tr').each((_, row) => {
    const key = clean($(row).find('th').text()).replace(':', '').toLowerCase();
    const valueCell = $(row).find('td');
    details[key] = { text: clean(valueCell.text()), url: valueCell.find('a[href]').attr('href') };
  });
  return details;
}

async function parseEvent(url) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const slug = slugFromUrl(url);
  const title = clean($('.pagetitle h1').first().text()) || clean($('h1').first().text());
  const details = eventDetails($);
  const date = dateFromItalian(details.data?.text || clean($('.pagetitle .subtitle').text()));
  if (!title || !date) throw new Error(`Titolo o data mancanti in ${url}`);

  const article = $('article.maincontent').first().clone();
  article.find('h2').filter((_, element) => /sessioni/i.test(clean($(element).text()))).nextAll().remove();
  article.find('h2').filter((_, element) => /sessioni/i.test(clean($(element).text()))).remove();
  article.find('.row').remove();
  await localizeImages($, article);
  await localizeMediaLinks($, article);
  const bodyHtml = article.html() || '';
  const body = turndown.turndown(bodyHtml).replace(/\n{3,}/g, '\n\n').trim();
  const description = clean($('meta[name="description"]').attr('content') || article.text()).slice(0, 300) || title;

  const sessions = [];
  $('article.maincontent > .row').each((_, row) => {
    const columns = $(row).children('[class*="col-"]');
    if (columns.length < 2) return;
    const first = columns.eq(0);
    const second = columns.eq(1);
    const time = clean(first.children('strong').first().text());
    const speakerText = clean(first.find('span').last().text());
    const sessionTitle = clean(second.children('strong').first().text());
    const sessionDescription = clean(second.find('p').text());
    if (!sessionTitle && !time) return;
    sessions.push({
      ...(time && { time }),
      title: sessionTitle || 'Sessione',
      speakers: speakerText ? speakerText.split(/\s+(?:&|e)\s+|,\s*/).filter(Boolean) : [],
      ...(sessionDescription && { description: sessionDescription })
    });
  });

  const materialMap = new Map();
  $('article.maincontent a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    const label = clean($(anchor).text());
    if (!href) return;
    const absolute = new URL(href, ORIGIN);
    if (/drive\.google|github\.com|slides|download/i.test(`${absolute.href} ${label}`)) materialMap.set(absolute.href, label || 'Materiale');
  });

  const registrationWidget = $('.sidebar .widget').filter((_, element) => /iscriviti all.evento/i.test(clean($(element).text()))).first();
  let registrationUrl = registrationWidget.find('a[href^="http"]').attr('href');
  if (!registrationUrl) registrationUrl = $('article.maincontent a[href*="eventbrite"], article.maincontent a[href*="sessionize"]').first().attr('href');
  if (registrationWidget.length && !registrationUrl) {
    report.warnings.push(`${url}: iscrizione originariamente interna, serve un nuovo URL esterno.`);
  }

  const firstBodyImage = article.find('img[src]').first().attr('src');
  const venueText = details.location?.text;
  const venueUrl = details.location?.url ? new URL(details.location.url, ORIGIN).href : undefined;
  const data = {
    title,
    description,
    date,
    ...(details.tipo?.text && { eventType: details.tipo.text }),
    ...(venueText && { venue: { name: venueText, ...(venueUrl && venueUrl !== `${ORIGIN}/#` && { url: venueUrl }), online: /virtual|online/i.test(venueText) } }),
    ...(firstBodyImage && { image: firstBodyImage }),
    sessions,
    materials: [...materialMap].map(([materialUrl, label]) => ({ label, url: materialUrl })),
    ...(registrationUrl && { registration: { url: new URL(registrationUrl, ORIGIN).href, label: 'Iscriviti all’evento' } }),
    sourceUrl: url,
    draft: false
  };
  const frontmatter = toYaml(data, { lineWidth: 0 }).trim();
  await writeFile(join(EVENTS_DIR, `${slug}.md`), `---\n${frontmatter}\n---\n\n${body || description}\n`);
  report.routes.push({ source: url, destination: `/eventi/${slug}/`, kind: 'evento', year: date.slice(0, 4) });
  report.eventCounts[date.slice(0, 4)] = (report.eventCounts[date.slice(0, 4)] || 0) + 1;
}

function externalLinks($, root) {
  const unique = new Map();
  root.find('a[href^="http"]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!href) return;
    try {
      const url = new URL(href);
      const label = url.hostname.replace(/^www\./, '');
      unique.set(url.href, { label, url: url.href });
    } catch {}
  });
  return [...unique.values()];
}

async function migratePeople() {
  const url = `${ORIGIN}/soci/`;
  const $ = cheerio.load(await fetchText(url));
  const cards = $('.cards > .row > [itemscope][itemtype*="Person"], .cards > [itemscope][itemtype*="Person"]').toArray();
  const seen = new Set();
  for (const cardElement of cards) {
    const card = $(cardElement);
    const modal = card.find('.modal[id^="popup_"]').first();
    const slug = modal.attr('id')?.replace(/^popup_/, '') || safeName(clean(card.find('[itemprop="name"]').first().text()));
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const name = clean(modal.find('.modal-title').clone().children().remove().end().text()) || clean(card.find('[itemprop="name"]').first().text());
    if (!name) continue;
    const title = clean(modal.find('[itemprop="jobTitle"]').first().text());
    const descriptionRoot = modal.find('[itemprop="description"]').first();
    const bio = turndown.turndown(descriptionRoot.html() || '').trim();
    const imageSource = modal.find('.modal-body img').first().attr('src') || card.find('img').first().attr('src');
    const image = imageSource && !/no_photo/i.test(imageSource) ? await saveAsset(imageSource) : undefined;
    const person = {
      name,
      sortName: name,
      ...(title && { title }),
      ...(image && { image }),
      roles: ['member'],
      links: externalLinks($, modal),
      published: true,
      sourceUrl: url
    };
    const frontmatter = toYaml(person, { lineWidth: 0 }).trim();
    await writeFile(join(PEOPLE_DIR, `${slug}.md`), `---\n${frontmatter}\n---\n${bio ? `\n${bio}\n` : ''}`);
    report.routes.push({ source: `${url}#${slug}`, destination: `/soci/${slug}/`, kind: 'socio' });
  }
  report.people = seen.size;
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  async function consume() {
    while (queue.length) {
      const item = queue.shift();
      try { await worker(item); }
      catch (error) { report.warnings.push(`${item}: ${error.message}`); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, consume));
}

async function discoverEventUrls() {
  const pages = [`${ORIGIN}/eventi/`, ...years.map((year) => `${ORIGIN}/eventi/${year}`)];
  const urls = new Set();
  for (const page of pages) {
    const $ = cheerio.load(await fetchText(page));
    $('a[href^="/eventi/"]').each((_, anchor) => {
      const absolute = new URL($(anchor).attr('href'), ORIGIN);
      const slug = slugFromUrl(absolute);
      if (slug && !/^\d{4}$/.test(slug) && absolute.pathname !== '/eventi/') urls.add(absolute.href);
    });
  }
  return [...urls].sort();
}

async function writeReport(eventTotal) {
  const routes = report.routes.sort((a, b) => a.destination.localeCompare(b.destination));
  const lines = [
    '# Rapporto di migrazione',
    '',
    `Generato il ${new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date())}.`,
    '',
    '## Riepilogo',
    '',
    `- Eventi migrati: ${eventTotal}`,
    `- Soci pubblici migrati: ${report.people}`,
    `- Asset locali scaricati: ${assetCache.size - report.missingAssets.length}`,
    `- Asset mancanti: ${report.missingAssets.length}`,
    `- Avvisi da verificare: ${report.warnings.length}`,
    '',
    '## Eventi per anno',
    '',
    '| Anno | Eventi |',
    '| ---: | ---: |',
    ...Object.entries(report.eventCounts).sort(([a], [b]) => Number(b) - Number(a)).map(([year, count]) => `| ${year} | ${count} |`),
    '',
    '## Avvisi',
    '',
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ['- Nessuno.']),
    '',
    '## Asset mancanti',
    '',
    ...(report.missingAssets.length ? report.missingAssets.map((asset) => `- ${asset}`) : ['- Nessuno.']),
    '',
    '## Mappatura degli URL',
    '',
    '| Tipo | Sorgente | Destinazione |',
    '| --- | --- | --- |',
    ...routes.map((route) => `| ${route.kind} | ${route.source} | ${route.destination} |`),
    ''
  ];
  await writeFile(REPORT_PATH, lines.join('\n'));
}

async function main() {
  await Promise.all([mkdir(EVENTS_DIR, { recursive: true }), mkdir(PEOPLE_DIR, { recursive: true }), mkdir(MEDIA_DIR, { recursive: true })]);
  const eventUrls = await discoverEventUrls();
  console.log(`Trovati ${eventUrls.length} eventi. Avvio la migrazione…`);
  await Promise.all([
    runPool(eventUrls, 6, parseEvent),
    migratePeople(),
    saveAsset('/media/1139/statutoxedotnet.pdf', 'statuto-xedotnet.pdf'),
    saveAsset('/media/1184/sessionize-logo.png'),
    saveAsset('/media/1223/logo_eventitech_200.png'),
    saveAsset('/media/1095/xedotnet_04.jpg')
  ]);
  await writeReport(eventUrls.length);
  console.log(`Migrazione completata: ${eventUrls.length} eventi, ${report.people} soci.`);
}

await main();
