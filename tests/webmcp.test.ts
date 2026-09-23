import { describe, expect, it } from 'vitest';
import {
  describeEvent,
  EVENT_CATALOG_PAGE_SIZE,
  eventForSlug,
  listEvents,
  WEBMCP_OUTPUT_CHARACTER_LIMIT,
} from '../src/lib/webmcp';
import type { WebMcpEventDetails, WebMcpEventSummary } from '../src/lib/webmcp';

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
