import * as cheerio from 'cheerio';

export const ORGANIZATION_SPEAKERS = new Set(['1nn0va', 'XE']);

export function normalizeSpeakerName(value = '') {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('it');
}

export function safeName(value = '') {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function splitSpeakerNames(value = '') {
  return value.split(/\s+(?:&|e)\s+|,\s*/).map((name) => name.trim()).filter(Boolean);
}

export function isOrganizationSpeaker(name) {
  return ORGANIZATION_SPEAKERS.has(name);
}

export function canonicalAssetUrl(source, origin = 'https://www.xedotnet.org') {
  const url = new URL(source.replace(/^~\//, '/'), origin);
  url.search = '';
  return url.href;
}

export function isUsableSpeakerImage(source = '') {
  if (!source) return false;
  const pathname = new URL(source.replace(/^~\//, '/'), 'https://www.xedotnet.org').pathname.toLowerCase();
  const filename = pathname.split('/').at(-1) ?? '';
  return !/(?:^|[-_])(xe(?:dotnet)?(?:[-_]|\.)|logo|no[-_]?photo|placeholder|avatar)/.test(filename);
}

export function extractLegacySpeakerCandidates(html, pageUrl) {
  const $ = cheerio.load(html);
  const candidates = [];
  $('article.maincontent > .row').each((_, row) => {
    const columns = $(row).children('[class*="col-"]');
    if (columns.length < 2) return;
    const speakerColumn = columns.eq(0);
    const names = splitSpeakerNames(speakerColumn.find('span').last().text().replace(/\s+/g, ' ').trim());
    const source = speakerColumn.find('img[src]').first().attr('src');
    if (names.length !== 1 || !source || !isUsableSpeakerImage(source)) return;
    candidates.push({
      name: names[0],
      imageUrl: canonicalAssetUrl(source, pageUrl),
      pageUrl
    });
  });
  return candidates;
}

export function selectImageCandidate(candidates = []) {
  const urls = [...new Set(candidates.map(({ imageUrl }) => imageUrl))];
  return urls.length === 1 ? urls[0] : undefined;
}

export function replaceSpeakerScalars(frontmatter, peopleByName) {
  return frontmatter.split('\n').map((line) => {
    const match = line.match(/^(\s{6})-\s+(.+?)\s*$/);
    if (!match) return line;
    const rawName = match[2].replace(/^("|')(.*)\1$/, '$2');
    const person = peopleByName.get(normalizeSpeakerName(rawName));
    return person ? `${match[1]}- person: ${person}` : line;
  }).join('\n');
}

export function markdownParts(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)$/);
  if (!match) throw new Error('Frontmatter Markdown non valido.');
  return { frontmatter: match[1], remainder: match[2] };
}

export function chooseKnownProfileUrl(links = []) {
  return links.find(({ url }) => /linkedin\.com/i.test(url))?.url ?? links[0]?.url;
}
