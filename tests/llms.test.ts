import { describe, expect, it, vi } from 'vitest';
import type { EventEntry } from '../src/lib/events';
import {
  llmsResponse,
  llmsTxtPath,
  renderAboutLlmsTxt,
  renderContactLlmsTxt,
  renderEventDetailLlmsTxt,
  renderEventsIndexLlmsTxt,
  renderEventsYearLlmsTxt,
  renderMemberDetailLlmsTxt,
  renderMembersIndexLlmsTxt,
  renderPrivacyLlmsTxt,
  renderRootLlmsTxt,
  resolveMarkdownUrls,
} from '../src/lib/llms';
import type { LocationEntry, PageEntry, SiteEntry } from '../src/lib/llms';
import type { PeopleContext, PersonEntry } from '../src/lib/people';

const SITE_URL = 'https://www.xedotnet.org/';
const MEMBERSHIP_YEAR = 2026;

const siteData: SiteEntry['data'] = {
  address: 'Via G. L. Bernini 72, 30034 Mira VE, Italia',
  description:
    'La community del Nord-Est dedicata a sviluppo software, tecnologia e condivisione.',
  donationButtonId: 'DONATE123',
  email: 'staff@xedotnet.org',
  fiscalCode: '94111660265',
  membershipButtonId: 'MEMBER123',
  name: 'XE - Development user group',
  navigation: [
    { href: '/', label: 'Home' },
    { href: '/chi-siamo/', label: 'Chi siamo' },
    { href: '/eventi/', label: 'Eventi' },
    { href: '/soci/', label: 'Soci' },
    { href: '/contatti/', label: 'Contatti' },
  ],
  newsletterAction: 'https://example.com/newsletter',
  newsletterHoneypot: 'b_honey',
  socials: [
    { label: 'Facebook', url: 'https://www.facebook.com/ugxedotnet' },
    { label: 'X', url: 'https://twitter.com/xedotnet' },
  ],
  tagline: 'Condividiamo tecnologia dal 2006',
};

function makePerson(
  id: string,
  name: string,
  overrides: Partial<PersonEntry['data']> = {},
  body = '',
): PersonEntry {
  return {
    body,
    collection: 'people',
    data: {
      links: [],
      name,
      published: true,
      sortName: name,
      ...overrides,
    },
    id,
  } as unknown as PersonEntry;
}

function makeEvent(
  id: string,
  data: Partial<EventEntry['data']> & { date: Date; title: string },
  body = '',
): EventEntry {
  return {
    body,
    collection: 'events',
    data: {
      description: 'Descrizione evento',
      draft: false,
      materials: [],
      registration: {},
      sessions: [],
      status: 'scheduled',
      ...data,
    },
    id,
  } as unknown as EventEntry;
}

describe('lib/llms.llmsTxtPath', () => {
  it('mappa la home e le pagine di sezione ai rispettivi file llms.txt nell’albero URL', () => {
    expect(llmsTxtPath('/', false, '/')).toBe('/llms.txt');
    expect(llmsTxtPath('/chi-siamo/', false, '/')).toBe('/chi-siamo/llms.txt');
    expect(llmsTxtPath('/eventi/', false, '/')).toBe('/eventi/llms.txt');
    expect(llmsTxtPath('/eventi/2025/', false, '/')).toBe(
      '/eventi/2025/llms.txt',
    );
    expect(llmsTxtPath('/eventi/net-conf-2026-xe/', false, '/')).toBe(
      '/eventi/net-conf-2026-xe/llms.txt',
    );
    expect(llmsTxtPath('/soci/', false, '/')).toBe('/soci/llms.txt');
    expect(llmsTxtPath('/soci/daniele-morosinotto/', false, '/')).toBe(
      '/soci/daniele-morosinotto/llms.txt',
    );
    expect(llmsTxtPath('/contatti/', false, '/')).toBe('/contatti/llms.txt');
    expect(llmsTxtPath('/privacy-policy/', false, '/')).toBe(
      '/privacy-policy/llms.txt',
    );
  });

  it('usa il file llms.txt principale per pagine noindex, 404 e grazie', () => {
    expect(llmsTxtPath('/grazie/', true, '/')).toBe('/llms.txt');
    expect(llmsTxtPath('/grazie/', false, '/')).toBe('/llms.txt');
    expect(llmsTxtPath('/404/', false, '/')).toBe('/llms.txt');
    expect(llmsTxtPath('/404.html', false, '/')).toBe('/llms.txt');
  });

  it('preserva il base path quando il sito è pubblicato in una sottocartella', () => {
    expect(llmsTxtPath('/xe-website/', false, '/xe-website/')).toBe(
      '/xe-website/llms.txt',
    );
    expect(llmsTxtPath('/xe-website/eventi/', false, '/xe-website/')).toBe(
      '/xe-website/eventi/llms.txt',
    );
    expect(
      llmsTxtPath(
        '/xe-website/soci/daniele-morosinotto/',
        false,
        '/xe-website/',
      ),
    ).toBe('/xe-website/soci/daniele-morosinotto/llms.txt');
    expect(llmsTxtPath('/xe-website/404.html', false, '/xe-website/')).toBe(
      '/xe-website/llms.txt',
    );
  });
});

describe('lib/llms.resolveMarkdownUrls & llmsResponse', () => {
  it('preserves Markdown titles while rewriting links and linked images under a deployment subpath', () => {
    vi.stubEnv('BASE_URL', '/xe-website/');
    try {
      const markdown = [
        '[One Day](/eventi/one-day-good-code/ "One Day - Good code")',
        "[Slides](/media/slides.pdf 'Session slides')",
        '[Agenda](/media/agenda.pdf (Event agenda))',
        '[![](/media/preview.png)](/media/agenda.pdf "Agenda")',
        '[External](https://example.com/ "External site")',
        '[CDN](//cdn.example.com/file.pdf "CDN")',
      ].join('\n');
      expect(resolveMarkdownUrls(markdown, 'https://example.com/')).toBe(
        [
          '[One Day](https://example.com/xe-website/eventi/one-day-good-code/ "One Day - Good code")',
          "[Slides](https://example.com/xe-website/media/slides.pdf 'Session slides')",
          '[Agenda](https://example.com/xe-website/media/agenda.pdf (Event agenda))',
          '[![](https://example.com/xe-website/media/preview.png)](https://example.com/xe-website/media/agenda.pdf "Agenda")',
          '[External](https://example.com/ "External site")',
          '[CDN](//cdn.example.com/file.pdf "CDN")',
        ].join('\n'),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('converte i link Markdown relativi alla radice in URL assoluti', () => {
    const markdown =
      'Torna alla [Home](/), consulta lo [Statuto](/media/statuto-xedotnet.pdf) e il [sito esterno](https://example.com/doc).';
    expect(resolveMarkdownUrls(markdown, SITE_URL)).toBe(
      'Torna alla [Home](https://www.xedotnet.org/), consulta lo [Statuto](https://www.xedotnet.org/media/statuto-xedotnet.pdf) e il [sito esterno](https://example.com/doc).',
    );
  });

  it('restituisce una risposta text/plain in UTF-8', async () => {
    const response = llmsResponse('# XE\n');
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(await response.text()).toBe('# XE\n');
  });
});

describe('lib/llms generatori dell’albero llms.txt', () => {
  const daniele = makePerson(
      'daniele-morosinotto',
      'Daniele Morosinotto',
      {
        links: [{ label: 'GitHub', url: 'https://github.com/danielem' }],
        title: 'Software Architect',
      },
      'Appassionato di sviluppo .NET e community.',
    ),
    externalSpeaker = makePerson('mario-rossi', 'Mario Rossi', {
      profileUrl: 'https://example.com/mario-rossi',
      published: false,
    }),
    context: PeopleContext = {
      memberIds: new Set(['daniele-morosinotto']),
      speakerIds: new Set(['daniele-morosinotto', 'mario-rossi']),
      year: MEMBERSHIP_YEAR,
    },
    upcomingEvent = makeEvent(
      '2026/2026-11-20-net-conf-2026',
      {
        date: new Date('2026-11-20T09:00:00Z'),
        description: 'Conferenza annuale sulle novità di .NET.',
        eventType: 'Conferenza',
        materials: [{ label: 'Locandina', url: '/media/locandina.pdf' }],
        registration: {
          endDate: new Date('2026-11-19T00:00:00Z'),
          startDate: new Date('2026-10-01T00:00:00Z'),
          url: 'https://eventbrite.example/netconf',
        },
        sessions: [
          {
            description: 'Panoramica sulle novità del runtime.',
            materials: [{ label: 'Slide', url: 'https://example.com/slides' }],
            speakers: [
              { person: { collection: 'people', id: 'daniele-morosinotto' } },
              { person: { collection: 'people', id: 'mario-rossi' } },
              'Relatore Ospite',
            ],
            time: '09:30 - 10:30',
            title: 'Novità di C# e .NET',
          },
        ],
        status: 'scheduled',
        title: '.NET Conf 2026 XE',
        venue: {
          name: 'Auditorium Mira',
          online: false,
          url: 'https://example.com/auditorium',
        },
      },
      'Dettagli completi della giornata e [programma PDF](/media/programma.pdf).',
    ),
    cancelledPastEvent = makeEvent('2025/2025-04-10-serata-annullata', {
      date: new Date('2025-04-10T18:30:00Z'),
      description: 'Incontro serale annullato.',
      status: 'cancelled',
      title: 'Serata Debug',
    }),
    now = new Date('2026-10-16T10:00:00Z');

  it('genera /llms.txt con l’albero del sito, prossimi eventi, archivio e risorse', () => {
    const output = renderRootLlmsTxt({
      context,
      events: [upcomingEvent, cancelledPastEvent],
      now,
      people: [daniele, externalSpeaker],
      site: siteData,
      siteUrl: SITE_URL,
    });

    expect(output).toContain('# XE - Development user group');
    expect(output).toContain('## Albero del sito (llms.txt)');
    expect(output).toContain(
      '[Chi siamo](https://www.xedotnet.org/chi-siamo/llms.txt)',
    );
    expect(output).toContain(
      '[Eventi](https://www.xedotnet.org/eventi/llms.txt)',
    );
    expect(output).toContain('[Soci](https://www.xedotnet.org/soci/llms.txt)');
    expect(output).toContain('anno associativo 2026');
    expect(output).toContain(
      '[.NET Conf 2026 XE](https://www.xedotnet.org/eventi/net-conf-2026/llms.txt)',
    );
    expect(output).toContain('evento programmato');
    expect(output).toContain(
      '[Eventi del 2025](https://www.xedotnet.org/eventi/2025/llms.txt)',
    );
  });

  it('genera /eventi/llms.txt e /eventi/<anno>/llms.txt con la gerarchia completa', () => {
    const indexOutput = renderEventsIndexLlmsTxt({
      events: [upcomingEvent, cancelledPastEvent],
      now,
      site: siteData,
      siteUrl: SITE_URL,
    });
    expect(indexOutput).toContain('## Posizione nell’albero');
    expect(indexOutput).toContain(
      '- Radice: [Home (llms.txt)](https://www.xedotnet.org/llms.txt)',
    );
    expect(indexOutput).toContain(
      '[Serata Debug](https://www.xedotnet.org/eventi/serata-annullata/llms.txt)',
    );
    expect(indexOutput).toContain('evento annullato');

    const yearOutput = renderEventsYearLlmsTxt({
      events: [cancelledPastEvent],
      site: siteData,
      siteUrl: SITE_URL,
      year: 2025,
    });
    expect(yearOutput).toContain(
      '# Eventi del 2025 — XE - Development user group',
    );
    expect(yearOutput).toContain(
      '- Sezione superiore: [Eventi (llms.txt)](https://www.xedotnet.org/eventi/llms.txt)',
    );
    expect(yearOutput).toContain('evento annullato');
  });

  it('genera /eventi/<slug>/llms.txt con stato, periodo di iscrizione, sessioni e link ai soci', () => {
    const peopleById = new Map([
        [daniele.id, daniele],
        [externalSpeaker.id, externalSpeaker],
      ]),
      detailOutput = renderEventDetailLlmsTxt({
        context,
        event: upcomingEvent,
        now,
        peopleById,
        site: siteData,
        siteUrl: SITE_URL,
      });

    expect(detailOutput).toContain('# .NET Conf 2026 XE');
    expect(detailOutput).toContain(
      '- Anno: [Eventi del 2026 (llms.txt)](https://www.xedotnet.org/eventi/2026/llms.txt)',
    );
    expect(detailOutput).toContain('- Stato: Evento programmato');
    expect(detailOutput).toContain(
      '- Periodo di iscrizione: Le iscrizioni sono aperte fino al 19 novembre 2026. ([Iscriviti](https://eventbrite.example/netconf))',
    );
    expect(detailOutput).toContain(
      '[programma PDF](https://www.xedotnet.org/media/programma.pdf)',
    );
    expect(detailOutput).toContain(
      '[Daniele Morosinotto](https://www.xedotnet.org/soci/daniele-morosinotto/llms.txt)',
    );
    expect(detailOutput).toContain(
      '[Mario Rossi](https://example.com/mario-rossi)',
    );
    expect(detailOutput).toContain('Relatore Ospite');
    expect(detailOutput).toContain(
      'Materiale: [Slide](https://example.com/slides)',
    );
    expect(detailOutput).toContain(
      '- [Locandina](https://www.xedotnet.org/media/locandina.pdf)',
    );
  });

  it('genera /soci/llms.txt e /soci/<slug>/llms.txt con albo soci e sessioni dello speaker', () => {
    const membersIndex = renderMembersIndexLlmsTxt({
      context,
      people: [daniele, externalSpeaker],
      site: siteData,
      siteUrl: SITE_URL,
    });
    expect(membersIndex).toContain('Albo soci (2026) — 1 socio');
    expect(membersIndex).toContain(
      '[Daniele Morosinotto](https://www.xedotnet.org/soci/daniele-morosinotto/llms.txt)',
    );
    expect(membersIndex).toContain('Socio e speaker');
    expect(membersIndex).not.toContain('Mario Rossi');

    const memberDetail = renderMemberDetailLlmsTxt({
      context,
      events: [upcomingEvent],
      member: daniele,
      site: siteData,
      siteUrl: SITE_URL,
    });
    expect(memberDetail).toContain('# Daniele Morosinotto');
    expect(memberDetail).toContain(
      '- Sezione superiore: [Soci (llms.txt)](https://www.xedotnet.org/soci/llms.txt)',
    );
    expect(memberDetail).toContain('- Ruolo: Socio e speaker');
    expect(memberDetail).toContain('- Anno associativo: 2026');
    expect(memberDetail).toContain('## Eventi con Daniele Morosinotto');
    expect(memberDetail).toContain(
      '[.NET Conf 2026 XE](https://www.xedotnet.org/eventi/net-conf-2026/llms.txt)',
    );
  });

  it('genera i file llms.txt per Chi siamo, Contatti e Privacy Policy', () => {
    const aboutPage = {
        body: 'Testo chi siamo con [Statuto](/media/statuto-xedotnet.pdf).',
        collection: 'pages',
        data: {
          description: 'Storia e valori di XE.',
          title: 'Chi siamo',
        },
        id: 'chi-siamo',
      } as unknown as PageEntry,
      locations = [
        {
          collection: 'locations',
          data: {
            count: 5,
            latitude: 45.6,
            longitude: 12.2,
            province: 'Treviso e provincia',
          },
          id: 'tv',
        },
      ] as unknown as LocationEntry[],
      aboutTxt = renderAboutLlmsTxt({
        locations,
        page: aboutPage,
        site: siteData,
        siteUrl: SITE_URL,
      });

    expect(aboutTxt).toContain(
      '[Statuto](https://www.xedotnet.org/media/statuto-xedotnet.pdf)',
    );
    expect(aboutTxt).toContain('- Treviso e provincia: 5 soci');

    const contactTxt = renderContactLlmsTxt({
      site: siteData,
      siteUrl: SITE_URL,
    });
    expect(contactTxt).toContain('staff@xedotnet.org');
    expect(contactTxt).toContain('- Pagina contatti: [Contatti](');
    expect(contactTxt).not.toContain('Modulo di contatto web');
    expect(contactTxt).toContain('https://www.xedotnet.org/contatti/llms.txt');

    const privacyPage = {
        body: 'Dettagli privacy.',
        collection: 'pages',
        data: {
          description: 'Trattamento dati.',
          title: 'Informativa sulla privacy',
        },
        id: 'privacy-policy',
      } as unknown as PageEntry,
      privacyTxt = renderPrivacyLlmsTxt({
        page: privacyPage,
        site: siteData,
        siteUrl: SITE_URL,
      });
    expect(privacyTxt).toContain('# Informativa sulla privacy');
    expect(privacyTxt).toContain('Dettagli privacy.');
  });
});
