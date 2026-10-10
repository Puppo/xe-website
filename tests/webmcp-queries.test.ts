import { describe, expect, it } from 'vitest';
import {
  eventResponse,
  memberResponse,
  searchEventMaterials,
} from '../src/lib/webmcp-queries';
import type { WebMcpFullEvent, WebMcpMemberDetails } from '../src/lib/webmcp';

const event: WebMcpFullEvent = {
  slug: 'test',
  title: 'Modernizzazione delle app',
  date: '2026-10-15T00:00:00Z',
  description: 'Agenti e applicazioni',
  body: '"Testo completo"\n'.repeat(500),
  period: 'upcoming',
  year: 2026,
  status: 'scheduled',
  url: 'https://example.com/eventi/test/',
  registration: {
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    url: 'https://example.com/iscrizione',
  },
  materials: [{ label: 'Slide', url: 'https://example.com/slide' }],
  sessions: [
    {
      title: 'Agenti sul Web',
      speakers: ['Ada'],
      materials: [{ label: 'Slide', url: 'https://example.com/slide' }],
    },
    {
      title: 'Seconda sessione',
      speakers: ['Ada'],
      materials: [{ label: 'Slide', url: 'https://example.com/slide' }],
    },
  ],
};
const member: WebMcpMemberDetails = {
  slug: 'ada',
  name: 'Ada',
  biography: 'Biografia completa '.repeat(200),
  excerpt: 'Biografia',
  roles: ['member', 'speaker'],
  externalLinks: [{ label: 'Profilo', url: 'https://example.com/ada' }],
  url: 'https://example.com/soci/ada/',
};

describe('sezioni e ricerca WebMCP', () => {
  it('riassume l’evento e pagina il contenuto senza perdere il testo', () => {
    const overview = eventResponse(
      [event],
      { slug: 'test' },
      new Date('2026-10-15T12:00:00Z'),
    );
    expect(overview).toMatchObject({
      registration: { state: 'open' },
      sessionCount: 2,
    });
    let offset = 0;
    let text = '';
    for (;;) {
      const page = eventResponse([event], {
        slug: 'test',
        section: 'body',
        offset,
      });
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
      if (!('text' in page)) throw new Error('Manca il testo.');
      text += page.text;
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    expect(text).toBe(event.body);
    expect(
      eventResponse([event], { slug: 'test', section: 'sessions' }),
    ).toMatchObject({ total: 2 });
  });

  it('legge biografia e link senza cambiare pagina', () => {
    expect(memberResponse(member, {})).toMatchObject({
      slug: 'ada',
      roles: ['member', 'speaker'],
    });
    expect(memberResponse(member, { section: 'biography' })).toHaveProperty(
      'nextOffset',
    );
    expect(memberResponse(member, { section: 'links' })).toMatchObject({
      links: member.externalLinks,
    });
    expect(() => memberResponse(member, { section: 'ignota' })).toThrow(
      /sezione/iu,
    );
  });

  it('trova materiali per contesto e conserva le sessioni deduplicando gli URL', () => {
    const result = searchEventMaterials([event], { query: 'modernizzazione' });
    expect(result.total).toBe(1);
    expect(result.materials[0]).toMatchObject({
      url: 'https://example.com/slide',
      eventSlug: 'test',
      sessions: ['Agenti sul Web', 'Seconda sessione'],
    });
    expect(searchEventMaterials([event], { query: 'ADA' }).total).toBe(1);
    expect(
      searchEventMaterials([event], { query: 'inesistente' }),
    ).toMatchObject({ total: 0, nextOffset: null });
    expect(() =>
      searchEventMaterials([event], { eventSlug: 'inesistente' }),
    ).toThrow(/non trovato/iu);
  });
});

it('ricostruisce biografie complete e collezioni di link senza salti', () => {
  const fullBiography = '"\\\n😀 Biografia completa '.repeat(300);
  const externalLinks = Array.from({ length: 12 }, (_, index) => ({
    label: `Collegamento ${index}`,
    url: `https://example.com/${index}?dati=${'x'.repeat(320)}`,
  }));
  const profile = { ...member, fullBiography, externalLinks };
  let offset = 0;
  let text = '';
  for (;;) {
    const page = memberResponse(profile, { section: 'biography', offset });
    if (!('text' in page)) throw new Error('Manca il testo.');
    expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
    text += page.text;
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  }
  expect(text).toBe(fullBiography);
  offset = 0;
  const links: typeof externalLinks = [];
  for (;;) {
    const page = memberResponse(profile, { section: 'links', offset });
    if (!('links' in page)) throw new Error('Mancano i link.');
    expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
    links.push(...page.links);
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  }
  expect(links).toEqual(externalLinks);
});

it('pagina programmi lunghi e segnala elementi che non possono entrare', () => {
  const sessions = Array.from({ length: 12 }, (_, index) => ({
    title: `Sessione ${index}`,
    description: '"Descrizione"\n'.repeat(25),
    speakers: ['Ada'],
  }));
  let offset = 0;
  const seen: typeof sessions = [];
  for (;;) {
    const page = eventResponse([{ ...event, sessions }], {
      slug: 'test',
      section: 'sessions',
      offset,
    });
    if (!('sessions' in page)) throw new Error('Manca il programma.');
    expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
    seen.push(
      ...page.sessions.map((session) => ({
        ...session,
        description: session.description ?? '',
      })),
    );
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  }
  expect(seen).toEqual(sessions);
  expect(() =>
    eventResponse(
      [
        {
          ...event,
          sessions: [
            {
              ...sessions[0],
              title: 'Talk',
              speakers: ['Ada'],
              description: 'x'.repeat(2000),
            },
          ],
        },
      ],
      { slug: 'test', section: 'sessions' },
    ),
  ).toThrow(/pagina/iu);
  expect(() =>
    memberResponse(
      { ...member, profileUrl: `https://example.com/${'x'.repeat(2000)}` },
      {},
    ),
  ).toThrow(/limite/iu);
});

it('pagina materiali conservando gli URL e le associazioni tra eventi', () => {
  const catalog = Array.from({ length: 12 }, (_, index) => ({
    ...event,
    slug: `evento-${index}`,
    title: `Evento ${index}`,
  }));
  let offset = 0;
  const seen: string[] = [];
  for (;;) {
    const page = searchEventMaterials(catalog, { offset });
    expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
    for (const item of page.materials) {
      expect(item.url).toBe('https://example.com/slide');
      expect(item.sessions).toEqual(['Agenti sul Web', 'Seconda sessione']);
      seen.push(item.eventSlug);
    }
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  }
  expect(seen).toEqual(catalog.map(({ slug }) => slug));
});
