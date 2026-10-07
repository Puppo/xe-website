import * as cheerio from 'cheerio';
import {
  normalizeSpeakerName,
  splitSpeakerNames,
} from './speaker-enrichment.mjs';

const clean = (value = '') => value.replaceAll(/\s+/gu, ' ').trim();

export function extractRowSessions(html) {
  const $ = cheerio.load(html),
    sessions = [];
  $('article.maincontent > .row').each((_, row) => {
    const columns = $(row).children('[class*="col-"]');
    if (columns.length < 2) return;
    const first = columns.eq(0),
      second = columns.eq(1),
      time = clean(first.children('strong').first().text()),
      title = clean(second.children('strong').first().text()),
      description = clean(second.find('p').text());
    if (!title && !time) return;
    sessions.push({
      title: title || 'Sessione',
      speakers: splitSpeakerNames(clean(first.find('span').last().text())),
      ...(time && { time }),
      ...(description && { description }),
    });
  });
  return sessions;
}

export function sessionizeUrls(html, pageUrl) {
  const $ = cheerio.load(html),
    urls = new Set();
  $('script[src], a[href], iframe[src]').each((_, element) => {
    const raw = $(element).attr('src') ?? $(element).attr('href');
    if (!raw) return;
    const url = new URL(raw, pageUrl);
    if (
      url.hostname !== 'sessionize.com' ||
      !/^\/api\/v2\/[^/]+\/view\/[^/]+\/?$/u.test(url.pathname)
    )
      return;
    url.search = '?under=True';
    urls.add(url.href);
  });
  return [...urls];
}

export function extractSessionizeSessions(
  html,
  seen = new Set(),
  warnings = [],
) {
  const $ = cheerio.load(html),
    sessions = [];
  $('.sz-session[data-sessionid]').each((_, element) => {
    const card = $(element),
      id = card.attr('data-sessionid'),
      title = clean(card.find('.sz-session__title').first().text());
    if (!title || seen.has(id)) return;
    seen.add(id);
    const time = clean(card.find('.sz-session__time').first().text()).match(
        /^\d{1,2}:\d{2}/u,
      )?.[0],
      speakers = card.hasClass('sz-session--service')
        ? []
        : card
            .find('.sz-session__speakers li')
            .toArray()
            .map((speaker) => clean($(speaker).text()))
            .filter(Boolean);
    const unique = [...new Set(speakers)];
    if (unique.length !== speakers.length)
      warnings.push(
        `${title}: nome speaker ripetuto nella fonte; conservata una sola associazione per nome.`,
      );
    sessions.push({ title, speakers: unique, ...(time && { time }) });
  });
  return sessions;
}

export function extractExplicitLists(html, eventTitle) {
  const $ = cheerio.load(html),
    sessions = [];
  $('article.maincontent ul, article.maincontent ol').each((_, list) => {
    const label = clean($(list).prev().text());
    if (
      /^(?:slide e codice sessioni|material[ei].*sessioni|sessioni)\s*:?$/iu.test(
        label,
      )
    ) {
      $(list)
        .children('li')
        .each((__, item) => {
          const text = clean($(item).clone().find('a').remove().end().text()),
            match = text.match(/^(.+?)\s*\(([^()]+)\)\s*$/u);
          if (match)
            sessions.push({
              title: match[1].trim(),
              speakers: splitSpeakerNames(match[2]),
            });
        });
    } else if (/^ospiti(?: della serata)?\s*:?$/iu.test(label)) {
      const speakers = $(list)
        .children('li')
        .toArray()
        .map((item) => clean($(item).find('strong').first().text()))
        .filter(Boolean);
      if (speakers.length > 0) sessions.push({ title: eventTitle, speakers });
    }
  });
  return sessions;
}

export async function recoverLegacySessions(html, pageUrl, title, fetchText) {
  const warnings = [],
    embedded = [],
    urls = sessionizeUrls(html, pageUrl),
    seen = new Set();
  for (const url of urls) {
    try {
      const agenda = await fetchText(url),
        sessions = extractSessionizeSessions(agenda, seen, warnings);
      if (extractSessionizeSessions(agenda).length === 0)
        warnings.push(
          `${url}: agenda non disponibile o formato non riconosciuto.`,
        );
      embedded.push(...sessions);
    } catch (error) {
      warnings.push(
        `${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const rows = extractRowSessions(html),
    sessions =
      embedded.length > 0
        ? embedded
        : rows.length > 0
          ? rows
          : extractExplicitLists(html, title),
    kind =
      embedded.length > 0
        ? 'Sessionize'
        : rows.length > 0
          ? 'righe'
          : sessions.length > 0
            ? 'elenco esplicito'
            : 'nessuna agenda riconosciuta';
  const $ = cheerio.load(html);
  $('article.maincontent a[href]').each((_, element) => {
    const link = $(element),
      url = new URL(link.attr('href'), pageUrl);
    if (
      (/agenda|programma/iu.test(clean(link.text())) ||
        (/^qui[.!]?$/iu.test(clean(link.text())) &&
          /agenda|programma/iu.test(clean(link.closest('p').text())))) &&
      url.hostname !== 'sessionize.com' &&
      url.origin !== new URL(pageUrl).origin
    ) {
      warnings.push(`${url.href}: agenda esterna da verificare manualmente.`);
    }
  });
  return { sessions, warnings, kind };
}

/** Preserve editorial fields and explicit references; only add confirmed omissions. */
export function mergeSessions(existing, recovered, peopleNames = new Map()) {
  const result = structuredClone(existing),
    speakerKey = (speaker) =>
      typeof speaker === 'string'
        ? normalizeSpeakerName(speaker)
        : normalizeSpeakerName(
            peopleNames.get(speaker.person) ?? speaker.person,
          );
  for (const incoming of recovered) {
    const candidates = existing.filter(
      (session) =>
        normalizeSpeakerName(session.title) ===
          normalizeSpeakerName(incoming.title) &&
        (!incoming.time || !session.time || incoming.time === session.time),
    );
    if (candidates.length > 1) continue;
    const target = candidates[0]
      ? result[existing.indexOf(candidates[0])]
      : undefined;
    if (!target) {
      result.push(structuredClone(incoming));
      continue;
    }
    const known = new Set((target.speakers ?? []).map(speakerKey));
    for (const speaker of incoming.speakers) {
      if (!known.has(speakerKey(speaker))) {
        (target.speakers ??= []).push(speaker);
        known.add(speakerKey(speaker));
      }
    }
  }
  return result;
}
