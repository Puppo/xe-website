import { describe, expect, it } from 'vitest';
import { eventInputSchema, personSchema } from '../src/content-schemas';
import {
  eventStructuredStatus,
  eventSlug,
  eventYear,
  formatEventDate,
  isPastEvent,
  nextScheduledEvent,
  registrationMessage,
  registrationState,
  sortAscending,
} from '../src/lib/events';
import type { EventEntry } from '../src/lib/events';
import { markdownExcerpt } from '../src/lib/text';

function event(date: string, data: Record<string, unknown> = {}): EventEntry {
  return {
    data: {
      date: new Date(`${date}T12:00:00Z`),
      registration: {},
      status: 'scheduled',
      ...data,
    },
    id: date,
  } as unknown as EventEntry;
}

describe('eventi', () => {
  it('formatta le date in italiano', () => {
    expect(formatEventDate(new Date('2026-09-18T12:00:00Z'))).toBe(
      'venerdì 18 settembre 2026',
    );
  });

  it('ricava l’anno nel fuso di Roma', () => {
    expect(eventYear(event('2026-09-18'))).toBe(2026);
  });

  it('ricava lo slug pubblico dal percorso organizzato per anno e data', () => {
    expect(
      eventSlug({ id: '2026/2026-09-18-serata-dotnet' } as EventEntry),
    ).toBe('serata-dotnet');
    expect(eventSlug({ id: 'serata-dotnet' } as EventEntry)).toBe(
      'serata-dotnet',
    );
  });

  it('ordina gli eventi dal meno recente', () => {
    const items = [event('2026-10-01'), event('2026-09-01')].sort(
      sortAscending,
    );
    expect(items[0].id).toBe('2026-09-01');
  });

  it('considera passato un evento concluso prima di oggi', () => {
    expect(
      isPastEvent(event('2025-01-01'), new Date('2026-01-01T12:00:00Z')),
    ).toBe(true);
    expect(
      isPastEvent(event('2027-01-01'), new Date('2026-01-01T12:00:00Z')),
    ).toBe(false);
  });

  it('deriva lo stato di iscrizione da date inclusive nel fuso di Roma', () => {
    const item = event('2026-10-20', {
      registration: {
        endDate: new Date('2026-10-15T00:00:00Z'),
        startDate: new Date('2026-10-01T00:00:00Z'),
        url: 'https://example.com/register',
      },
    });

    expect(registrationState(item, new Date('2026-09-30T12:00:00Z'))).toBe(
      'not-open',
    );
    expect(registrationState(item, new Date('2026-09-30T22:30:00Z'))).toBe(
      'open',
    );
    expect(registrationState(item, new Date('2026-10-15T21:59:00Z'))).toBe(
      'open',
    );
    expect(registrationState(item, new Date('2026-10-15T22:30:00Z'))).toBe(
      'closed',
    );
    expect(
      registrationMessage(item, new Date('2026-09-30T12:00:00Z')),
    ).toContain('1 ottobre 2026');
    expect(
      registrationMessage(item, new Date('2026-10-10T12:00:00Z')),
    ).toContain('15 ottobre 2026');
  });

  it('gestisce eventi senza periodo di iscrizione', () => {
    expect(
      registrationState(event('2027-01-01'), new Date('2026-01-01T12:00:00Z')),
    ).toBe('unavailable');
    expect(
      registrationState(event('2025-01-01'), new Date('2026-01-01T12:00:00Z')),
    ).toBe('closed');
  });

  it('dà precedenza all’annullamento e lo esclude dal prossimo incontro', () => {
    const cancelled = event('2026-10-01', { status: 'cancelled' }),
      scheduled = event('2026-11-01');

    expect(registrationState(cancelled)).toBe('cancelled');
    expect(registrationMessage(cancelled)).toContain('annullato');
    expect(nextScheduledEvent([cancelled, scheduled])).toBe(scheduled);
    expect(eventStructuredStatus(cancelled)).toBe(
      'https://schema.org/EventCancelled',
    );
    expect(eventStructuredStatus(scheduled)).toBe(
      'https://schema.org/EventScheduled',
    );
  });
});

describe('schema evento', () => {
  const baseEvent = {
    date: '2026-10-20',
    description: 'Descrizione',
    sourceUrl: 'https://example.com/event',
    title: 'Evento di prova',
  };

  it('accetta un periodo di iscrizione valido', () => {
    expect(
      eventInputSchema.safeParse({
        ...baseEvent,
        registration: {
          endDate: '2026-10-20',
          startDate: '2026-10-01',
          url: 'https://example.com/register',
        },
      }).success,
    ).toBe(true);
  });

  it('accetta speaker legacy e riferimenti a profili', () => {
    expect(
      eventInputSchema.safeParse({
        ...baseEvent,
        sessions: [
          {
            speakers: ['XE', { person: 'emanuele-furlan' }],
            title: 'Sessione',
          },
        ],
      }).success,
    ).toBe(true);
  });

  it.each([
    { person: '' },
    { person: 42 },
    { name: 'Speaker senza riferimento' },
  ])('rifiuta un riferimento speaker non valido: %o', (speaker) => {
    expect(
      eventInputSchema.safeParse({
        ...baseEvent,
        sessions: [{ speakers: [speaker], title: 'Sessione' }],
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      registration: {
        startDate: '2026-10-01',
        url: 'https://example.com/register',
      },
    },
    { registration: { endDate: '2026-10-10', startDate: '2026-10-01' } },
    {
      registration: {
        endDate: '2026-10-01',
        startDate: '2026-10-10',
        url: 'https://example.com/register',
      },
    },
    {
      registration: {
        endDate: '2026-10-21',
        startDate: '2026-10-01',
        url: 'https://example.com/register',
      },
    },
  ])('rifiuta un periodo di iscrizione incoerente', (invalid) => {
    expect(
      eventInputSchema.safeParse({ ...baseEvent, ...invalid }).success,
    ).toBe(false);
  });
});

describe('profili', () => {
  it('convalida il link principale del profilo', () => {
    const profile = {
      name: 'Ada Lovelace',
      profileUrl: 'https://www.linkedin.com/in/ada-lovelace',
      roles: ['speaker'],
      sortName: 'Lovelace, Ada',
    };
    expect(personSchema.safeParse(profile).success).toBe(true);
    expect(
      personSchema.safeParse({ ...profile, profileUrl: 'non-un-url' }).success,
    ).toBe(false);
  });

  it('crea una descrizione SEO dal contenuto Markdown', () => {
    expect(
      markdownExcerpt(
        '## Sviluppatore\n\nLavora con **.NET** e [Astro](https://astro.build).',
      ),
    ).toBe('Sviluppatore Lavora con .NET e Astro.');
  });

  it('tronca la descrizione senza spezzare le parole', () => {
    expect(
      markdownExcerpt(
        'Una descrizione sufficientemente lunga per essere accorciata.',
        32,
      ),
    ).toBe('Una descrizione sufficientemente…');
  });

  it('mantiene vuota una biografia assente', () => {
    expect(markdownExcerpt('')).toBe('');
  });
});
