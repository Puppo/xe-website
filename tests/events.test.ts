import { describe, expect, it } from 'vitest';
import { eventYear, formatEventDate, isPastEvent, registrationMessage, sortAscending, type EventEntry } from '../src/lib/events';
import { markdownExcerpt } from '../src/lib/text';

function event(date: string): EventEntry {
  return { id: date, data: { date: new Date(`${date}T12:00:00Z`) } } as unknown as EventEntry;
}

describe('eventi', () => {
  it('formatta le date in italiano', () => {
    expect(formatEventDate(new Date('2026-09-18T12:00:00Z'))).toBe('venerdì 18 settembre 2026');
  });

  it('ricava l’anno nel fuso di Roma', () => {
    expect(eventYear(event('2026-09-18'))).toBe(2026);
  });

  it('ordina gli eventi dal meno recente', () => {
    const items = [event('2026-10-01'), event('2026-09-01')].sort(sortAscending);
    expect(items[0].id).toBe('2026-09-01');
  });

  it('considera passato un evento concluso prima di oggi', () => {
    expect(isPastEvent(event('2025-01-01'), new Date('2026-01-01T12:00:00Z'))).toBe(true);
    expect(isPastEvent(event('2027-01-01'), new Date('2026-01-01T12:00:00Z'))).toBe(false);
  });

  it('fornisce messaggi italiani per ogni stato di iscrizione', () => {
    expect(registrationMessage('not-open')).toContain('non sono ancora aperte');
    expect(registrationMessage('open')).toContain('sono aperte');
    expect(registrationMessage('sold-out')).toContain('esauriti');
    expect(registrationMessage('closed')).toContain('chiuse');
  });
});

describe('profili', () => {
  it('crea una descrizione SEO dal contenuto Markdown', () => {
    expect(markdownExcerpt('## Sviluppatore\n\nLavora con **.NET** e [Astro](https://astro.build).'))
      .toBe('Sviluppatore Lavora con .NET e Astro.');
  });

  it('tronca la descrizione senza spezzare le parole', () => {
    expect(markdownExcerpt('Una descrizione sufficientemente lunga per essere accorciata.', 32))
      .toBe('Una descrizione sufficientemente…');
  });

  it('mantiene vuota una biografia assente', () => {
    expect(markdownExcerpt('')).toBe('');
  });
});
