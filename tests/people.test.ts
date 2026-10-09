import { describe, expect, it } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  createSpeakerIds,
  groupByInitial,
  recentEventsForPerson,
} from '../src/lib/people';

type Person = CollectionEntry<'people'>;
type Event = CollectionEntry<'events'>;

function person(
  id: string,
  name: string,
  extra: Partial<Person['data']> = {},
): Person {
  return {
    id,
    data: {
      links: [],
      name,
      published: true,
      sortName: name,
      ...extra,
    },
  } as unknown as Person;
}

function event(id: string, dateISO: string, speakerIds: string[]): Event {
  return {
    id,
    data: {
      date: new Date(dateISO),
      description: '',
      draft: false,
      materials: [],
      registration: {},
      sessions: speakerIds.map((sp) => ({
        speakers: [{ person: sp }],
        title: 'Talk',
      })),
      sourceUrl: 'https://example.com/',
      status: 'scheduled',
      title: id,
    },
  } as unknown as Event;
}

describe('groupByInitial', () => {
  it('orders bands alphabetically with the Italian locale', () => {
    const bands = groupByInitial([
      person('c', 'Carla'),
      person('a', 'Anna'),
      person('b', 'Bruno'),
    ]);
    expect(bands.map((g) => g.letter)).toEqual(['A', 'B', 'C']);
    expect(bands.flatMap((g) => g.items.map((i) => i.id))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('keeps input order inside a band', () => {
    const bands = groupByInitial([
      person('a-anna', 'Anna'),
      person('a-aldo', 'Aldo'),
    ]);
    expect(bands[0]?.items.map((i) => i.id)).toEqual(['a-anna', 'a-aldo']);
  });

  it('folds diacritics for the first letter', () => {
    const bands = groupByInitial([person('o', 'Olga'), person('e', 'Ève')]);
    expect(bands.map((g) => g.letter)).toEqual(['E', 'O']);
  });

  it('drops a leading "Avv." honorific before picking the initial', () => {
    const bands = groupByInitial([person('p', 'Avv. Paolo Vicenzotto')]);
    expect(bands[0]?.letter).toBe('P');
  });
});

describe('recentEventsForPerson', () => {
  it('returns date-descending events where the member spoke', () => {
    const events = [
      event('old', '2023-06-01', ['mauro-cavallin']),
      event('new', '2025-04-01', ['mauro-cavallin']),
      event('other', '2025-04-01', ['someone-else']),
    ];
    const recent = recentEventsForPerson(
      person('mauro-cavallin', 'Mauro'),
      events,
    );
    expect(recent.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('honours the limit argument', () => {
    const events = ['2024-01-01', '2023-01-01', '2022-01-01', '2021-01-01'].map(
      (d, i) => event(`e${i}`, d, ['mauro-cavallin']),
    );
    expect(
      recentEventsForPerson(person('mauro-cavallin', 'Mauro'), events, 2),
    ).toHaveLength(2);
  });

  it('returns an empty array when the person did not speak anywhere', () => {
    expect(recentEventsForPerson(person('x', 'X'), [])).toEqual([]);
  });
});

describe('speaker derivati dagli eventi', () => {
  it('unisce riferimenti sorgente e Astro senza duplicati tra sessioni', () => {
    const ids = createSpeakerIds([
      {
        data: {
          draft: false,
          sessions: [
            { speakers: [{ person: 'ada' }, { person: { id: 'bruno' } }] },
            { speakers: [{ person: { id: 'ada' } }, { person: 'bruno' }] },
          ],
        },
      },
    ]);
    expect([...ids]).toEqual(['ada', 'bruno']);
  });

  it('riconosce eventi storici, futuri e annullati senza dipendere dalla data', () => {
    const historical = event('storico', '2006-01-01', ['ada']);
    const future = event('futuro', '2099-01-01', ['bruno']);
    historical.data.status = 'cancelled';
    expect([...createSpeakerIds([historical, future])]).toEqual([
      'ada',
      'bruno',
    ]);
  });

  it('esclude bozze e stringhe legacy anche se coincidono con uno slug', () => {
    const draft = event('bozza', '2026-01-01', ['ada']);
    draft.data.draft = true;
    const legacy = event('legacy', '2026-01-01', []);
    legacy.data.sessions = [
      { title: 'Talk', materials: [], speakers: ['ada', 'Ada Lovelace'] },
    ];
    expect([...createSpeakerIds([draft, legacy])]).toEqual([]);
    expect(
      recentEventsForPerson(person('ada', 'Ada'), [draft, legacy]),
    ).toEqual([]);
  });

  it('gestisce elenchi senza eventi o senza sessioni', () => {
    expect([...createSpeakerIds([])]).toEqual([]);
    expect([...createSpeakerIds([event('vuoto', '2026-01-01', [])])]).toEqual(
      [],
    );
  });

  it('usa i riferimenti Astro anche per la cronologia del profilo', () => {
    const resolved = event('risolto', '2026-01-01', []);
    resolved.data.sessions = [
      {
        title: 'Talk',
        materials: [],
        speakers: [{ person: { collection: 'people', id: 'ada' } }],
      },
    ];
    expect([...createSpeakerIds([resolved])]).toEqual(['ada']);
    expect(recentEventsForPerson(person('ada', 'Ada'), [resolved])).toEqual([
      resolved,
    ]);
  });
});
