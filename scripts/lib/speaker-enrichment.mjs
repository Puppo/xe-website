import * as cheerio from 'cheerio';
import { parseDocument } from 'yaml';

export const ORGANIZATION_SPEAKERS = new Set(['1nn0va', 'XE']);

export function normalizeSpeakerName(value = '') {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036F]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('it');
}

export function safeName(value = '') {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

export function splitSpeakerNames(value = '') {
  return value
    .split(/\s+(?:&|e)\s+|,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
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
  if (!source) {
    return false;
  }
  const pathname = new URL(
      source.replace(/^~\//, '/'),
      'https://www.xedotnet.org',
    ).pathname.toLowerCase(),
    filename = pathname.split('/').at(-1) ?? '';
  return !/(?:^|[-_])(xe(?:dotnet)?(?:[-_]|\.)|logo|no[-_]?photo|placeholder|avatar)/.test(
    filename,
  );
}

export function extractLegacySpeakerCandidates(html, pageUrl) {
  const $ = cheerio.load(html),
    candidates = [];
  $('article.maincontent > .row').each((_, row) => {
    const columns = $(row).children('[class*="col-"]');
    if (columns.length < 2) {
      return;
    }
    const speakerColumn = columns.eq(0),
      names = splitSpeakerNames(
        speakerColumn.find('span').last().text().replaceAll(/\s+/g, ' ').trim(),
      ),
      source = speakerColumn.find('img[src]').first().attr('src');
    if (names.length !== 1 || !source || !isUsableSpeakerImage(source)) {
      return;
    }
    candidates.push({
      imageUrl: canonicalAssetUrl(source, pageUrl),
      name: names[0],
      pageUrl,
    });
  });
  return candidates;
}

export function selectImageCandidate(candidates = []) {
  const urls = [...new Set(candidates.map(({ imageUrl }) => imageUrl))];
  return urls.length === 1 ? urls[0] : undefined;
}

export function createPeopleNameIndex(people) {
  const index = new Map();
  for (const person of people) {
    const key = normalizeSpeakerName(person.data.name),
      matches = index.get(key) ?? [];
    matches.push(person);
    index.set(key, matches);
  }
  return index;
}

export function matchSpeaker(name, peopleByName) {
  if (isOrganizationSpeaker(name)) return { kind: 'organization' };
  const matches = peopleByName.get(normalizeSpeakerName(name)) ?? [];
  if (matches.length > 1)
    return { kind: 'ambiguous', ids: matches.map(({ id }) => id) };
  return matches.length === 1
    ? { kind: 'matched', person: matches[0] }
    : { kind: 'missing' };
}

export function replaceSessions(frontmatter, sessions) {
  const document = parseDocument(frontmatter);
  if (document.errors.length > 0) throw document.errors[0];
  const previous = document.toJS().sessions ?? [];
  if (JSON.stringify(previous) === JSON.stringify(sessions)) return frontmatter;
  if (previous.length === 0 || sessions.length < previous.length) {
    document.set('sessions', sessions);
  } else {
    for (const [index, session] of sessions.entries()) {
      if (index >= previous.length) {
        document.addIn(['sessions'], session);
        continue;
      }
      for (const [key, value] of Object.entries(session)) {
        if (JSON.stringify(previous[index][key]) !== JSON.stringify(value)) {
          document.setIn(['sessions', index, key], value);
        }
      }
    }
  }
  return document.toString({ lineWidth: 0 }).trimEnd();
}

export function replaceSpeakerScalars(frontmatter, peopleByName) {
  const document = parseDocument(frontmatter);
  if (document.errors.length > 0) throw document.errors[0];
  const sessions = document.toJS().sessions ?? [];
  for (const session of sessions) {
    session.speakers = (session.speakers ?? []).map((speaker) => {
      const id =
        typeof speaker === 'string'
          ? peopleByName.get(normalizeSpeakerName(speaker))
          : undefined;
      return id ? { person: id } : speaker;
    });
  }
  return replaceSessions(frontmatter, sessions);
}

export function markdownParts(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)$/);
  if (!match) {
    throw new Error('Frontmatter Markdown non valido.');
  }
  return { frontmatter: match[1], remainder: match[2] };
}

export function chooseKnownProfileUrl(links = []) {
  return (
    links.find(({ url }) => /linkedin\.com/i.test(url))?.url ?? links[0]?.url
  );
}
