import { eventForSlug, eventMaterials, getEvent } from './webmcp';
import type { WebMcpFullEvent, WebMcpMemberDetails } from './webmcp';
import {
  checkedOutput,
  paginateItems,
  paginateText,
  truncate,
  validateOffset,
} from './webmcp-pagination';

function sectionInput(
  input: Record<string, unknown>,
  allowed: readonly string[],
) {
  const section = input.section ?? 'overview';
  if (typeof section !== 'string' || !allowed.includes(section)) {
    throw new TypeError(
      'La sezione non è valida. Scegli una delle sezioni disponibili.',
    );
  }
  const offset = input.offset ?? 0;
  if (typeof offset !== 'number')
    throw new TypeError('L’offset deve essere un numero intero.');
  validateOffset(offset);
  return { section, offset };
}

export function eventResponse(
  catalog: WebMcpFullEvent[],
  input: Record<string, unknown>,
  now = new Date(),
) {
  const { section, offset } = sectionInput(input, [
    'overview',
    'body',
    'sessions',
    'materials',
  ]);
  const event = getEvent(catalog, input.slug, now);
  const context = { slug: event.slug, section, url: event.url };
  if (section === 'body') return paginateText(event.body, offset, context);
  if (section === 'sessions') {
    return paginateItems(event.sessions, offset, (sessions, nextOffset) => ({
      ...context,
      sessions,
      offset,
      nextOffset,
      total: event.sessions.length,
    }));
  }
  if (section === 'materials') {
    const allMaterials = eventMaterials(event);
    return paginateItems(allMaterials, offset, (materials, nextOffset) => ({
      ...context,
      materials,
      offset,
      nextOffset,
      total: allMaterials.length,
    }));
  }
  return checkedOutput({
    ...context,
    title: truncate(event.title, 160),
    description: truncate(event.description, 240),
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    period: event.period,
    venue: event.venue ? truncate(event.venue, 80) : undefined,
    eventType: event.eventType ? truncate(event.eventType, 60) : undefined,
    registration: event.registration,
    sessionCount: event.sessions.length,
    materialCount: eventMaterials(event).length,
    bodyLength: event.body.length,
    truncated:
      event.title.length > 160 ||
      event.description.length > 240 ||
      (event.venue?.length ?? 0) > 80 ||
      (event.eventType?.length ?? 0) > 60,
  });
}

export function memberResponse(
  member: WebMcpMemberDetails,
  input: Record<string, unknown>,
) {
  const { section, offset } = sectionInput(input, [
    'overview',
    'biography',
    'links',
  ]);
  const context = { slug: member.slug, section, url: member.url };
  const biography = member.fullBiography ?? member.biography;
  if (section === 'biography') return paginateText(biography, offset, context);
  if (section === 'links') {
    return paginateItems(member.externalLinks, offset, (links, nextOffset) => ({
      ...context,
      links,
      offset,
      nextOffset,
      total: member.externalLinks.length,
    }));
  }
  return checkedOutput({
    ...context,
    name: truncate(member.name, 120),
    roles: member.roles,
    title: member.title ? truncate(member.title, 120) : undefined,
    biography: truncate(biography, 360),
    biographyLength: biography.length,
    profileUrl: member.profileUrl,
    linkCount: member.externalLinks.length,
    truncated:
      member.name.length > 120 ||
      (member.title?.length ?? 0) > 120 ||
      biography.length > 360,
  });
}

function searchText(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('it-IT')
    .trim();
}

export function searchEventMaterials(
  catalog: WebMcpFullEvent[],
  input: Record<string, unknown>,
) {
  const { query, eventSlug } = input;
  if (query !== undefined && typeof query !== 'string')
    throw new TypeError('Il testo di ricerca deve essere una stringa.');
  const events =
    eventSlug === undefined ? catalog : [eventForSlug(catalog, eventSlug)];
  const needle = typeof query === 'string' ? searchText(query) : '';
  const matches = events.flatMap((event) =>
    eventMaterials(event).flatMap((material) => {
      const sessions = event.sessions.filter((session) =>
        session.materials?.some(({ url }) => url === material.url),
      );
      const text = [
        material.label,
        event.title,
        event.description,
        ...sessions.flatMap((session) => [
          session.title,
          session.description ?? '',
          ...session.speakers,
        ]),
        ...(event.speakers ?? []),
      ]
        .map(searchText)
        .join('\n');
      if (needle && !text.includes(needle)) return [];
      return [
        {
          label: truncate(material.label, 120),
          url: material.url,
          eventSlug: event.slug,
          eventTitle: truncate(event.title, 120),
          eventUrl: event.url,
          sessions: sessions.map((session) => truncate(session.title, 120)),
          truncated:
            material.label.length > 120 ||
            event.title.length > 120 ||
            sessions.some((session) => session.title.length > 120),
        },
      ];
    }),
  );
  const offset = input.offset ?? 0;
  if (typeof offset !== 'number')
    throw new TypeError('L’offset deve essere un numero intero.');
  return paginateItems(matches, offset, (materials, nextOffset) => ({
    materials,
    offset,
    nextOffset,
    total: matches.length,
    ...(matches.length === 0
      ? {
          suggestion:
            'Prova un argomento più ampio o rimuovi il filtro sull’evento.',
        }
      : {}),
  }));
}
