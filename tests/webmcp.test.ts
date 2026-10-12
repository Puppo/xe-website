import { describe, expect, it } from 'vitest';
import {
  describeEvent,
  describeMember,
  EVENT_CATALOG_PAGE_SIZE,
  eventForSlug,
  eventMaterials,
  getEvent,
  listEvents,
  listMembers,
  MEMBER_CATALOG_PAGE_SIZE,
  memberForSlug,
  WEBMCP_OUTPUT_CHARACTER_LIMIT,
} from '../src/lib/webmcp';
import type {
  WebMcpEventDetails,
  WebMcpFullEvent,
  WebMcpEventSummary,
  WebMcpMemberDetails,
  WebMcpMemberSummary,
} from '../src/lib/webmcp';

const catalog: WebMcpEventSummary[] = Array.from(
  { length: EVENT_CATALOG_PAGE_SIZE + 2 },
  (_, index) => ({
    date: `2026-${String(index + 1).padStart(2, '0')}-10T12:00:00.000Z`,
    description:
      index === 0
        ? 'Una serata dedicata a WebMCP e agli agenti.'
        : `Descrizione evento ${index}`,
    eventType: index === 0 ? 'Tech-Pub' : 'Conferenza',
    endDate: index === 0 ? '2026-01-12T12:00:00.000Z' : undefined,
    period: index < 2 ? 'upcoming' : 'past',
    slug: `evento-${index}`,
    speakers:
      index === 0 ? ['Gianni Rosà', 'Emanuele Furlan'] : ['Relatore diverso'],
    status: index === 1 ? 'cancelled' : 'scheduled',
    title: `Evento ${index}`,
    url: `https://www.xedotnet.org/eventi/evento-${index}/`,
    venue: index === 0 ? 'Treviso' : 'Online',
    year: index < 4 ? 2026 : 2025,
  }),
);

describe('WebMCP event catalog', () => {
  it('filters by text, year and period without losing cancelled events', () => {
    expect(listEvents(catalog, { query: 'WebMCP' }).events).toHaveLength(1);
    expect(listEvents(catalog, { year: 2025 }).total).toBe(3);
    const past = listEvents(
      catalog,
      { period: 'past' },
      new Date('2026-09-29'),
    );
    expect(past.total).toBe(catalog.length);
    expect(past.events.some((event) => event.status === 'cancelled')).toBe(
      true,
    );
    expect(
      listEvents(
        catalog.slice(0, 1),
        { period: 'upcoming' },
        new Date('2026-01-11'),
      ).total,
    ).toBe(1);
    expect(
      listEvents(
        catalog.slice(0, 1),
        { period: 'past' },
        new Date('2026-01-13'),
      ).total,
    ).toBe(1);
  });

  it('paginates events with at most five items per page', () => {
    const firstPage = listEvents(catalog, {}),
      secondPage = listEvents(catalog, {
        offset: firstPage.nextOffset ?? undefined,
      });
    expect(firstPage.events.length).toBeLessThanOrEqual(
      EVENT_CATALOG_PAGE_SIZE,
    );
    expect(firstPage.nextOffset).toBe(firstPage.events.length);
    expect(
      [...firstPage.events, ...secondPage.events].map((item) => item.slug),
    ).toEqual(catalog.map((item) => item.slug));
    expect(secondPage.nextOffset).toBeNull();
  });

  it('rejects invalid offsets and years', () => {
    expect(() => listEvents(catalog, { offset: -1 })).toThrow(/offset/i);
    expect(() => listEvents(catalog, { year: 2026.5 })).toThrow(/anno/i);
  });

  it('rejects slugs missing from the catalog', () => {
    expect(() => eventForSlug(catalog, 'evento-sconosciuto')).toThrow(
      /non trovato/iu,
    );
  });

  it('combines overlapping intervals, title, description and speakers', () => {
    const result = listEvents(catalog, {
      dateFrom: '2026-01-12',
      dateTo: '2026-01-15',
      title: 'evento 0',
      description: 'agenti',
      speakers: ['Nessuno', 'ROSA'],
    });
    expect(result.events.map((event) => event.slug)).toEqual(['evento-0']);
    expect(
      listEvents(catalog, { dateFrom: '2026-01-13' }).events,
    ).not.toContainEqual(expect.objectContaining({ slug: 'evento-0' }));
    expect(listEvents(catalog, { speakers: ['furlan'] }).total).toBe(1);
    expect(listEvents(catalog, { query: 'gianni rosa' }).total).toBe(1);
  });

  it('rejects impossible dates, reversed intervals and empty speaker filters', () => {
    expect(() => listEvents(catalog, { dateFrom: '2026-02-30' })).toThrow(
      /valida/iu,
    );
    expect(() =>
      listEvents(catalog, { dateFrom: '2026-02-01', dateTo: '2026-01-01' }),
    ).toThrow(/iniziale/iu);
    expect(() => listEvents(catalog, { speakers: [] })).toThrow(/relatore/iu);
    expect(() => listEvents(catalog, { speakers: [' '] })).toThrow(
      /relatore/iu,
    );
  });

  it('returns complete details and updates registration availability', () => {
    const [first] = catalog;
    if (!first) {
      throw new Error('The test catalog is empty.');
    }
    const event: WebMcpFullEvent = {
      ...first,
      body: 'Contenuto completo.',
      materials: [{ label: 'Slide', url: 'https://example.com/slide' }],
      registration: {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-10T00:00:00.000Z',
        url: 'https://example.com/iscrizione',
      },
      sessions: [
        {
          title: 'Sessione',
          speakers: ['Gianni Rosà'],
          description: 'Dettagli del talk.',
        },
      ],
    };
    const open = getEvent(
      [event],
      'evento-0',
      new Date('2026-01-10T12:00:00Z'),
    );
    expect(open.registration.state).toBe('open');
    expect(open.registration.url).toBe(event.registration.url);
    expect(open.body).toBe('Contenuto completo.');
    expect(open.sessions[0]?.description).toBe('Dettagli del talk.');
    const closed = getEvent(
      [event],
      'evento-0',
      new Date('2026-01-11T12:00:00Z'),
    );
    expect(closed.registration.state).toBe('closed');
    expect(closed.registration.url).toBeUndefined();
  });
});

describe('WebMCP event description', () => {
  const details: WebMcpEventDetails = {
    date: 'venerdì 18 settembre 2026',
    description: 'Una serata della community dedicata agli agenti.',
    eventType: 'Tech-Pub',
    materials: [{ label: 'Slide', url: 'https://example.com/slide' }],
    registration: {
      message: 'Le iscrizioni sono aperte.',
      url: 'https://example.com/register',
    },
    sessions: [
      {
        speakers: ['Ada Lovelace'],
        time: '20:00',
        title: 'Agenti sul Web',
      },
    ],
    status: 'scheduled',
    title: 'WebMCP per le community',
    url: 'https://www.xedotnet.org/eventi/webmcp-community/',
    venue: 'Treviso',
  };

  it('includes details, speakers, registration and materials', () => {
    const description = describeEvent(details);
    expect(description).toContain('WebMCP per le community');
    expect(description).toContain('Ada Lovelace');
    expect(description).toContain('Le iscrizioni sono aperte');
    expect(description).toContain('Slide: https://example.com/slide');
  });

  it('recalculates registration from original dates despite stale static messages', () => {
    const source: WebMcpEventDetails = {
      ...details,
      sourceDate: '2026-10-20T00:00:00Z',
      registration: {
        message: 'Le iscrizioni sono chiuse.',
        startDate: '2026-10-10T00:00:00Z',
        endDate: '2026-10-15T00:00:00Z',
        sourceUrl: 'https://example.com/iscrizione',
      },
    };
    const open = describeEvent(source, 1500, new Date('2026-10-10T12:00:00Z'));
    expect(open).toContain('Le iscrizioni sono aperte');
    expect(open).toContain(source.registration.sourceUrl);
    const closed = describeEvent(
      source,
      1500,
      new Date('2026-10-15T22:00:00Z'),
    );
    expect(closed).toContain('Le iscrizioni sono chiuse');
    expect(closed).not.toContain(source.registration.sourceUrl);
    expect(
      describeEvent(
        { ...source, status: 'cancelled' },
        1500,
        new Date('2026-10-10'),
      ),
    ).toContain('annullato');
  });

  it('preserves the aggregated catalog and describes each resource once with its session', () => {
    const slide = details.materials[0],
      shared = {
        label: 'Cartella comune',
        url: 'https://example.com/folder?key=1#demo',
      },
      event = {
        ...details,
        materials: [shared, slide],
        sessions: [{ ...details.sessions[0], materials: [slide] }],
      },
      description = describeEvent(event);
    expect(eventMaterials(event)).toEqual([shared, slide]);
    expect(description).toContain(
      'Slide (Agenti sul Web): https://example.com/slide',
    );
    expect(description.match(/https:\/\/example.com\/slide/gu)).toHaveLength(1);
    expect(description).toContain(shared.url);
    expect(
      eventMaterials({
        materials: [slide],
        sessions: [{ materials: [slide] }, {}],
      }),
    ).toEqual([slide]);
  });

  it('respects the budget and flags omitted details', () => {
    const description = describeEvent(
      {
        ...details,
        sessions: Array.from({ length: 50 }, (_, index) => ({
          speakers: [`Relatore ${index}`],
          title: `Sessione molto dettagliata numero ${index}`,
        })),
      },
      WEBMCP_OUTPUT_CHARACTER_LIMIT,
    );
    expect(description.length).toBeLessThanOrEqual(
      WEBMCP_OUTPUT_CHARACTER_LIMIT,
    );
    expect(description).toContain('dettagli omessi');
  });

  it('omits sessions when the program is too long', () => {
    const sessions = Array.from({ length: 50 }, (_, index) => ({
        speakers: [`Relatore ${index}`],
        title: `Sessione unica numero ${index}`,
      })),
      description = describeEvent(
        { ...details, sessions },
        WEBMCP_OUTPUT_CHARACTER_LIMIT,
      );
    expect(description.length).toBeLessThanOrEqual(
      WEBMCP_OUTPUT_CHARACTER_LIMIT,
    );
    expect(description).toContain('dettagli omessi');
    const dropped = sessions.filter(
      (session) => !description.includes(session.title),
    );
    expect(dropped.length).toBeGreaterThan(0);
  });
});

const memberCatalog: WebMcpMemberSummary[] = Array.from(
  { length: MEMBER_CATALOG_PAGE_SIZE + 2 },
  (_, index) => ({
    excerpt:
      index === 0
        ? 'Esperto di accessibilità e community building.'
        : `Estratto del socio ${index}`,
    externalLinks:
      index === 0
        ? [{ label: 'LinkedIn', url: 'https://linkedin.com/in/test' }]
        : [],
    hasBiography: true,
    hasImage: index % 2 === 0,
    name: `Socio ${index}`,
    profileUrl: index === 0 ? 'https://linkedin.com/in/test' : undefined,
    roles: index === 1 ? ['speaker'] : ['member', 'speaker'],
    slug: `socio-${index}`,
    title: index === 0 ? 'Accessibility Lead' : undefined,
    url: `https://www.xedotnet.org/soci/socio-${index}/`,
  }),
);

describe('WebMCP member catalog', () => {
  it('filters text across names, titles and excerpts', () => {
    const result = listMembers(memberCatalog, { query: 'accessibilità' });
    expect(result.total).toBe(1);
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.name).toBe('Socio 0');
  });

  it('filters by role and includes members with both roles', () => {
    const speakers = listMembers(memberCatalog, { role: 'speaker' });
    expect(speakers.total).toBe(MEMBER_CATALOG_PAGE_SIZE + 2);
    const onlyMembers = listMembers(memberCatalog, { role: 'member' });
    expect(onlyMembers.total).toBe(MEMBER_CATALOG_PAGE_SIZE + 1);
  });

  it('paginates results in groups of five', () => {
    const firstPage = listMembers(memberCatalog, {}),
      secondPage = listMembers(memberCatalog, {
        offset: firstPage.nextOffset ?? undefined,
      });
    expect(firstPage.members).toHaveLength(MEMBER_CATALOG_PAGE_SIZE);
    expect(firstPage.nextOffset).toBe(MEMBER_CATALOG_PAGE_SIZE);
    expect(secondPage.members).toHaveLength(2);
    expect(secondPage.nextOffset).toBeNull();
  });

  it('truncates excerpts to 120 characters in the current page', () => {
    const first = memberCatalog[0];
    if (!first) {
      throw new Error('Catalog fixture is empty');
    }
    const longExcerpt = `Estratto ${'a'.repeat(200)} finale`,
      result = listMembers([{ ...first, excerpt: longExcerpt }], {});
    expect(result.members[0]?.excerpt.length).toBeLessThanOrEqual(121);
  });

  it('rejects invalid offsets', () => {
    expect(() => listMembers(memberCatalog, { offset: -1 })).toThrow(/offset/i);
  });

  it('rejects slugs missing from the catalog', () => {
    expect(() => memberForSlug(memberCatalog, 'socio-sconosciuto')).toThrow(
      /non trovato/iu,
    );
  });

  it('rejects non-string slugs', () => {
    expect(() => memberForSlug(memberCatalog, 42)).toThrow(/slug.*socio/i);
  });
});

describe('WebMCP member description', () => {
  const details: WebMcpMemberDetails = {
    biography: 'Esperto di accessibilità, speaker e membro della community.',
    excerpt: 'Esperto di accessibilità e community building.',
    externalLinks: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/test' }],
    name: 'Ada Community',
    profileUrl: 'https://linkedin.com/in/test',
    roles: ['member', 'speaker'],
    slug: 'ada-community',
    title: 'Accessibility Lead',
    url: 'https://www.xedotnet.org/soci/ada-community/',
  };

  it('includes roles, biography, title, links and external profile', () => {
    const description = describeMember(details);
    expect(description).toContain('Ada Community');
    expect(description).toContain('Accessibility Lead');
    expect(description).toContain('socio e relatore');
    expect(description).toContain('Esperto di accessibilità');
    expect(description).toContain('LinkedIn: https://linkedin.com/in/test');
    expect(description).toContain(
      'Profilo esterno: https://linkedin.com/in/test',
    );
  });

  it('respects the budget and flags omitted details', () => {
    const biography = 'Biografia '.repeat(500).trim(),
      externalLinks = Array.from({ length: 200 }, (_, index) => ({
        label: `Link ${index}`,
        url: `https://example.com/${index}`,
      })),
      description = describeMember(
        { ...details, biography, externalLinks },
        WEBMCP_OUTPUT_CHARACTER_LIMIT,
      );
    expect(description.length).toBeLessThanOrEqual(
      WEBMCP_OUTPUT_CHARACTER_LIMIT,
    );
    expect(description).toContain('dettagli omessi');
  });

  it('correctly describes a person who is only a speaker', () => {
    const description = describeMember({
      ...details,
      roles: ['speaker'],
    });
    expect(description).toContain('relatore');
    expect(description).not.toContain('socio e relatore');
  });
});
