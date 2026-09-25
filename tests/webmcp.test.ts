import { describe, expect, it } from 'vitest';
import {
  describeEvent,
  describeMember,
  EVENT_CATALOG_PAGE_SIZE,
  eventForSlug,
  listEvents,
  listMembers,
  MEMBER_CATALOG_PAGE_SIZE,
  memberForSlug,
  WEBMCP_OUTPUT_CHARACTER_LIMIT,
} from '../src/lib/webmcp';
import type {
  WebMcpEventDetails,
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
    period: index < 2 ? 'upcoming' : 'past',
    slug: `evento-${index}`,
    status: index === 1 ? 'cancelled' : 'scheduled',
    title: `Evento ${index}`,
    url: `https://www.xedotnet.org/eventi/evento-${index}/`,
    venue: index === 0 ? 'Treviso' : 'Online',
    year: index < 4 ? 2026 : 2025,
  }),
);

describe('catalogo WebMCP degli eventi', () => {
  it('filtra per testo, anno e periodo senza perdere gli eventi annullati', () => {
    expect(listEvents(catalog, { query: 'WebMCP' }).events).toHaveLength(1);
    expect(listEvents(catalog, { year: 2025 }).total).toBe(3);
    const upcoming = listEvents(catalog, { period: 'upcoming' });
    expect(upcoming.total).toBe(2);
    expect(upcoming.events[1]?.status).toBe('cancelled');
  });

  it('pagina i risultati in gruppi di cinque', () => {
    const firstPage = listEvents(catalog, {}),
      secondPage = listEvents(catalog, {
        offset: firstPage.nextOffset ?? undefined,
      });
    expect(firstPage.events).toHaveLength(EVENT_CATALOG_PAGE_SIZE);
    expect(firstPage.nextOffset).toBe(EVENT_CATALOG_PAGE_SIZE);
    expect(secondPage.events).toHaveLength(2);
    expect(secondPage.nextOffset).toBeNull();
  });

  it('rifiuta offset e anni non validi', () => {
    expect(() => listEvents(catalog, { offset: -1 })).toThrow(/offset/i);
    expect(() => listEvents(catalog, { year: 2026.5 })).toThrow(/anno/i);
  });

  it('rifiuta uno slug non presente nel catalogo', () => {
    expect(() => eventForSlug(catalog, 'evento-sconosciuto')).toThrow(
      /non trovato/iu,
    );
  });
});

describe('descrizione WebMCP di un evento', () => {
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

  it('include dettagli, relatori, iscrizione e materiali', () => {
    const description = describeEvent(details);
    expect(description).toContain('WebMCP per le community');
    expect(description).toContain('Ada Lovelace');
    expect(description).toContain('Le iscrizioni sono aperte');
    expect(description).toContain('Slide: https://example.com/slide');
  });

  it('rispetta il limite e segnala i dettagli omessi', () => {
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

  it('omette effettivamente delle sessioni quando il programma è molto lungo', () => {
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

describe('catalogo WebMCP dei soci', () => {
  it('filtra per testo su nome, titolo ed estratto', () => {
    const result = listMembers(memberCatalog, { query: 'accessibilità' });
    expect(result.total).toBe(1);
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.name).toBe('Socio 0');
  });

  it('filtra per ruolo e mantiene tutti i soci con entrambi i ruoli', () => {
    const speakers = listMembers(memberCatalog, { role: 'speaker' });
    expect(speakers.total).toBe(MEMBER_CATALOG_PAGE_SIZE + 2);
    const onlyMembers = listMembers(memberCatalog, { role: 'member' });
    expect(onlyMembers.total).toBe(MEMBER_CATALOG_PAGE_SIZE + 1);
  });

  it('pagina i risultati in gruppi di cinque', () => {
    const firstPage = listMembers(memberCatalog, {}),
      secondPage = listMembers(memberCatalog, {
        offset: firstPage.nextOffset ?? undefined,
      });
    expect(firstPage.members).toHaveLength(MEMBER_CATALOG_PAGE_SIZE);
    expect(firstPage.nextOffset).toBe(MEMBER_CATALOG_PAGE_SIZE);
    expect(secondPage.members).toHaveLength(2);
    expect(secondPage.nextOffset).toBeNull();
  });

  it('tronca l’estratto a 120 caratteri nella pagina corrente', () => {
    const first = memberCatalog[0];
    if (!first) {
      throw new Error('Catalog fixture is empty');
    }
    const longExcerpt = `Estratto ${'a'.repeat(200)} finale`,
      result = listMembers([{ ...first, excerpt: longExcerpt }], {});
    expect(result.members[0]?.excerpt.length).toBeLessThanOrEqual(121);
  });

  it('rifiuta offset non validi', () => {
    expect(() => listMembers(memberCatalog, { offset: -1 })).toThrow(/offset/i);
  });

  it('rifiuta uno slug non presente nel catalogo', () => {
    expect(() => memberForSlug(memberCatalog, 'socio-sconosciuto')).toThrow(
      /non trovato/iu,
    );
  });

  it('rifiuta uno slug che non è una stringa', () => {
    expect(() => memberForSlug(memberCatalog, 42)).toThrow(/slug.*socio/i);
  });
});

describe('descrizione WebMCP di un socio', () => {
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

  it('include ruoli, biografia, titolo, link e profilo esterno', () => {
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

  it('rispetta il limite e segnala i dettagli omessi', () => {
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

  it('descrive correttamente un socio che è solo relatore', () => {
    const description = describeMember({
      ...details,
      roles: ['speaker'],
    });
    expect(description).toContain('relatore');
    expect(description).not.toContain('socio e relatore');
  });
});
