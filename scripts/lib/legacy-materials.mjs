import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { normalizeSpeakerName } from './speaker-enrichment.mjs';

const clean = (value = '') => value.replaceAll(/\s+/gu, ' ').trim(),
  key = (value) => normalizeSpeakerName(value).replaceAll(/[’']/gu, "'"),
  resourceWords =
    /\b(?:slide|slides|codice|materiale|materiali|demo|presentazione|presentazioni|scarica|download)\b/iu,
  resourcePrompt =
    /^(?:e['’]?\s*possibile scaricare|il materiale|le slide|link al (?:repository|codice)|(?:slide|codice|demo)(?:\s+[^:]{1,80})?\s*:|slide e codice sessioni|disponibile il materiale|material[ei](?: delle? sessioni)?\s*:|scarica(?:re)? (?:presentazione|slide)|presentazione(?: e codice)? disponib)/iu,
  contextualWords = /prerequisit|installat|installare|account|templates/iu,
  markdown = unified().use(remarkParse),
  turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    br: '\\',
  });

// Verified on the linked Blazor Conf agenda, whose keynote has this prefix.
const titleExceptions = new Map([
  [
    '/eventi/blazorconf2026/',
    new Map([
      [
        key("Il problema non è Blazor (e neanche l'AI)"),
        key("Keynote - Il problema non è Blazor (e neanche l'AI)"),
      ],
    ]),
  ],
]);

function nodeText(node) {
  return node.value ?? (node.children ?? []).map(nodeText).join('');
}

function linksIn(node) {
  return [
    ...(node.type === 'link' ? [{ url: node.url, label: nodeText(node) }] : []),
    ...(node.children ?? []).flatMap(linksIn),
  ];
}

export function uniqueMaterials(materials) {
  const seen = new Set();
  return materials.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function materialLabel(label, context, url, owned) {
  const text = `${label} ${context}`;
  if (!owned && label && !/^https?:|^download$|^materiale$/iu.test(label))
    return label;
  if (/slide.*codice|presentazione.*(?:codice|demo)/iu.test(label))
    return /demo/iu.test(label) ? 'Slide e demo' : 'Slide e codice';
  if (/^demo$/iu.test(label)) return 'Demo';
  if (/slide|presentazione/iu.test(label) && !/^https?:/iu.test(label))
    return owned ? 'Slide' : label;
  if (/^github$/iu.test(label)) return 'Codice';
  if (
    /^https?:/iu.test(label) &&
    /codice/iu.test(context) &&
    /slides?|presentazione/iu.test(context)
  )
    return 'Slide e codice';
  if (
    /slideshare|speakerdeck|slides\.com|\.pdf(?:$|\?)/iu.test(url) ||
    /\bslide\b/iu.test(text)
  )
    return 'Slide';
  if (/github\.com/iu.test(url)) return 'Codice';
  if (!label || /^https?:|^download$|^materiale$/iu.test(label))
    return 'Materiali';
  return label;
}

function precedingLabel($, element) {
  let current = element;
  while (current.length > 0 && !current.is('article')) {
    const previous = current
      .prevAll('p, h2, h3')
      .filter((_, node) => clean($(node).text()))
      .first();
    if (previous.length > 0) return clean(previous.text());
    current = current.parent();
  }
  return '';
}

/** Retain ownership before legacy rows and lists are flattened into Markdown. */
export function extractLegacyMaterials(html, pageUrl) {
  const $ = cheerio.load(html),
    evidence = [];
  $('article.maincontent a[href]').each((_, element) => {
    const anchor = $(element),
      raw = anchor.attr('href');
    if (!raw || anchor.find('img').length > 0) return;
    let url;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol)) return;
    const closest = anchor.closest('li, p'),
      block = closest.length > 0 ? closest : anchor.parent(),
      list = anchor.closest('ul, ol'),
      heading = precedingLabel($, list.length > 0 ? list : block),
      context = clean(block.text() || anchor.text()),
      label = clean(anchor.text()),
      row = anchor.closest('article.maincontent > .row'),
      columns = row.children('[class*="col-"]'),
      title = clean(columns.eq(1).children('strong').first().text()),
      time = clean(columns.eq(0).children('strong').first().text()),
      speakers = clean(columns.eq(0).find('span').last().text()),
      contextOnly = contextualWords.test(`${context} ${heading}`);
    if (/agenda|programma/iu.test(label) || url.hostname === 'sessionize.com')
      return;
    // Empty accidental anchors in abstracts carry no attribution evidence.
    if (
      !label &&
      !resourcePrompt.test(heading) &&
      !resourcePrompt.test(context)
    )
      return;
    const kind =
      contextOnly || !resourceWords.test(`${label} ${context} ${heading}`)
        ? 'context'
        : 'resource';
    const withoutLink = block.clone();
    withoutLink.find('a').remove();
    const caption = clean(withoutLink.text()),
      explicit = caption.match(/^(.+?)\s*\(([^()]+)\)\s*$/u),
      prompt =
        block.is('p') &&
        (resourcePrompt.test(context) || clean(block.text()) === label)
          ? context
          : undefined;
    evidence.push({
      url: url.href,
      label,
      context,
      heading,
      kind,
      ...(title && { title, time, speakers }),
      ...(!title &&
        explicit && { title: explicit[1].trim(), speakers: explicit[2] }),
      ...(prompt && { prompt }),
      ...(block.length > 0 && {
        contextMarkdown: turndown
          .turndown(
            $.html(
              kind === 'context' && list.length > 0
                ? list.parents('ul, ol').last().length > 0
                  ? list.parents('ul, ol').last()
                  : list
                : block,
            ),
          )
          .replaceAll(/^[\t ]+$/gmu, '')
          .trim(),
      }),
    });
  });
  return evidence;
}

function findNamedSessions(context, sessions, peopleNames) {
  return sessions
    .map((session, index) => ({ session, index }))
    .filter(({ session }) => {
      if (context.includes(key(session.title)) && key(session.title).length > 6)
        return true;
      return (session.speakers ?? []).some((speaker) => {
        const name = key(
            typeof speaker === 'string'
              ? speaker
              : (peopleNames.get(speaker.person) ?? ''),
          ),
          surname = name.split(' ').at(-1);
        return (
          name.length > 0 &&
          (context.includes(name) ||
            (surname.length > 3 &&
              ['codice', 'slide', 'materiale'].some((word) =>
                context.includes(`${word} ${surname}`),
              )))
        );
      });
    })
    .map(({ index }) => index);
}

function matchingSessions(evidence, sessions, peopleNames, pageUrl) {
  const title =
      titleExceptions
        .get(new URL(pageUrl).pathname)
        ?.get(key(evidence.title || evidence.label)) ??
      key(evidence.title || evidence.label),
    exact = sessions
      .map((session, index) => ({ session, index }))
      .filter(
        ({ session }) =>
          key(session.title) === title &&
          (!evidence.time || !session.time || evidence.time === session.time),
      );
  if (exact.length > 0) return exact.map(({ index }) => index);
  if (evidence.title) return [];
  const labelled = findNamedSessions(
    key(evidence.label),
    sessions,
    peopleNames,
  );
  if (labelled.length > 0) return labelled;
  const candidates = findNamedSessions(
    key(evidence.context),
    sessions,
    peopleNames,
  );
  if (candidates.length > 0) return candidates;
  if (
    /^(?:slide e codice|slide|codice)\s+.+/iu.test(evidence.label) &&
    !/^slide e codice$/iu.test(evidence.label)
  )
    return [];
  // An explicit event resource belongs to its sole substantive speaker session.
  return sessions.flatMap((session, index) =>
    (session.speakers ?? []).length > 0 &&
    !/^(?:q\s*&\s*a|introduzione|saluti(?: finali)?|benvenuto(?: & introduzione| e keynote)?)$/iu.test(
      session.title,
    )
      ? [index]
      : [],
  );
}

function removeNodes(source, nodes) {
  const ranges = nodes
    .map((node) => [node.position.start.offset, node.position.end.offset])
    .sort((a, b) => b[0] - a[0]);
  let result = source;
  for (const [start, end] of ranges) {
    const trailing =
      result.slice(end).match(/^\r?\n(?:\r?\n)?/u)?.[0].length ?? 0;
    result = result.slice(0, start) + result.slice(end + trailing);
  }
  if (ranges.some(([, end]) => !source.slice(end).trim()))
    return `${result.trimEnd()}\n`;
  return result;
}

/** Delete only resource-only blocks whose links have a structured destination. */
export function cleanMaterialMarkdown(source, urls) {
  const tree = markdown.parse(source),
    removed = [];
  let activeMarker,
    section = false;
  for (const node of tree.children) {
    const text = clean(nodeText(node)),
      links = linksIn(node),
      prompt = resourcePrompt.test(text),
      preserved = links.length > 0 && links.every(({ url }) => urls.has(url));
    if (
      prompt &&
      links.length === 0 &&
      ['paragraph', 'heading'].includes(node.type)
    ) {
      activeMarker = node;
      section = true;
      continue;
    }
    if (node.type === 'list') {
      const items = node.children.filter((item) => {
        const itemLinks = linksIn(item);
        return (
          itemLinks.length > 0 &&
          itemLinks.every(({ url }) => urls.has(url)) &&
          (section || resourcePrompt.test(clean(nodeText(item))))
        );
      });
      removed.push(...(items.length === node.children.length ? [node] : items));
      if (activeMarker && items.length > 0) removed.push(activeMarker);
      section = false;
      activeMarker = undefined;
      continue;
    }
    if (
      preserved &&
      (prompt ||
        (section &&
          node.children.every(
            (child) =>
              child.type === 'link' ||
              (child.type === 'text' && !child.value.trim()),
          )))
    ) {
      removed.push(node);
      if (activeMarker) {
        removed.push(activeMarker);
        activeMarker = undefined;
      }
      continue;
    }
    section = false;
    activeMarker = undefined;
  }
  return removeNodes(source, removed);
}

function stripSourcePrompt(description, prompt) {
  const compact = prompt.replaceAll(/\s/gu, '');
  if (!description.replaceAll(/\s/gu, '').endsWith(compact)) return description;
  let index = description.length,
    remaining = compact.length;
  while (index > 0 && remaining > 0) {
    index -= 1;
    if (!/\s/u.test(description[index])) remaining -= 1;
  }
  return description.slice(0, index).trimEnd();
}

export function recoverEventMaterials({
  data,
  body,
  evidence,
  peopleNames = new Map(),
}) {
  const sessions = structuredClone(data.sessions ?? []),
    warnings = [],
    resources = new Map(),
    contextual = new Map();
  for (const entry of evidence ?? []) {
    const target = entry.kind === 'resource' ? resources : contextual,
      entries = target.get(entry.url) ?? [];
    entries.push(entry);
    target.set(entry.url, entries);
  }
  const tree = markdown.parse(body),
    bodyUrls = new Set(linksIn(tree).map(({ url }) => url)),
    known = uniqueMaterials([
      ...(data.materials ?? []),
      ...sessions.flatMap((session) => session.materials ?? []),
      ...[...resources].map(([url, entries]) => ({
        url,
        label: entries[0].label,
      })),
      ...[...contextual]
        .filter(([, entries]) => entries.some((entry) => entry.title))
        .map(([url, entries]) => ({ url, label: entries[0].label })),
    ]),
    existingOwned = new Set(
      sessions.flatMap((session) =>
        (session.materials ?? []).map(({ url }) => url),
      ),
    ),
    shared = [],
    contextBlocks = new Set();
  for (const material of known) {
    if (existingOwned.has(material.url)) continue;
    const entries = resources.get(material.url) ?? [],
      contexts = contextual.get(material.url) ?? [];
    if (entries.length === 0 && contexts.length > 0) {
      const context = contexts.find((entry) =>
        entry.contextMarkdown?.includes(material.url),
      );
      if (context && !bodyUrls.has(material.url)) {
        // Preserve a whole prerequisite list, rather than orphan its introductory text.
        const label = contextualWords.test(
            `${context.context} ${context.heading}`,
          )
            ? 'Prerequisiti'
            : 'Riferimenti',
          block = `## ${label}${context.title ? ` — ${context.title}` : ''}\n\n${context.contextMarkdown}`;
        contextBlocks.add(block);
      }
      if (bodyUrls.has(material.url) || context) continue;
    }
    const matches = new Set(
      entries
        .filter((entry) => entry.label)
        .flatMap((entry) =>
          matchingSessions(entry, sessions, peopleNames, data.sourceUrl),
        ),
    );
    // Conflicting source rows or names must not select a talk arbitrarily.
    if (matches.size === 1) {
      const [index] = matches,
        session = sessions[index],
        entry = entries[0],
        label = materialLabel(
          key(entry.label) === key(session.title) ||
            titleExceptions
              .get(new URL(data.sourceUrl).pathname)
              ?.has(key(entry.label))
            ? 'Materiali'
            : entry.label || material.label,
          entry.context,
          material.url,
          true,
        );
      (session.materials ??= []).push({ label, url: material.url });
    } else {
      shared.push({
        ...material,
        label: materialLabel(
          material.label,
          entries[0]?.context ?? '',
          material.url,
          false,
        ),
      });
      if (
        matches.size > 1 &&
        entries.some(
          (entry) =>
            entry.title ||
            (!/^(?:slide|slide e codice|codice|demo|material[ei]|download)$/iu.test(
              entry.label,
            ) &&
              /^(?:slide|codice)\s+.+/iu.test(entry.label)) ||
            findNamedSessions(key(entry.label), sessions, peopleNames).length >
              0,
        )
      )
        warnings.push(
          `${material.url}: associazione ambigua; conservato tra i materiali dell’evento.`,
        );
      else if (entries.length === 0)
        warnings.push(
          `${material.url}: attribuzione non disponibile; conservato tra i materiali dell’evento.`,
        );
      else if (entries.every((entry) => !entry.label))
        warnings.push(
          `${material.url}: collegamento legacy senza etichetta; conservato tra i materiali dell’evento.`,
        );
      else if (
        matches.size === 0 &&
        entries.some(
          (entry) =>
            entry.title || /^(?:slide|codice)\s+.+/iu.test(entry.label),
        )
      )
        warnings.push(
          `${material.url}: talk indicato dalla fonte non identificato; conservato tra i materiali dell’evento.`,
        );
    }
  }
  for (const session of sessions) {
    if (!session.materials) continue;
    session.materials = uniqueMaterials(session.materials);
    for (const material of session.materials) {
      for (const entry of resources.get(material.url) ?? []) {
        if (
          entry.prompt &&
          session.description &&
          (!entry.title || key(entry.title) === key(session.title))
        )
          session.description = stripSourcePrompt(
            session.description,
            entry.prompt,
          );
      }
    }
    if (session.description === '') delete session.description;
  }
  const urls = new Set(
    [...shared, ...sessions.flatMap((session) => session.materials ?? [])].map(
      ({ url }) => url,
    ),
  );
  let remainder = cleanMaterialMarkdown(body, urls);
  if (contextBlocks.size > 0)
    remainder = `${remainder.trimEnd()}\n\n${[...contextBlocks].join('\n\n')}\n`;
  return { sessions, materials: shared, body: remainder, warnings };
}
