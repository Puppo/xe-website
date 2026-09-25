import { describe, expect, it } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  groupByInitial,
  hasRichProfile,
  linkKind,
  nextAlphabeticalNeighbors,
  recentEventsForPerson,
  roleLabel,
} from '../src/lib/people';
import { markdownHeadings } from '../src/lib/text';

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
      roles: ['member'],
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

describe('hasRichProfile', () => {
  it('matches when the person has both image and either title or links', () => {
    expect(
      hasRichProfile(person('a', 'A', { image: '/a.png', title: 'Dev' })),
    ).toBe(true);
    expect(
      hasRichProfile(
        person('a', 'A', {
          image: '/a.png',
          links: [{ label: 'Site', url: 'https://a.example' }],
        }),
      ),
    ).toBe(true);
  });

  it('rejects members without an image, even with rich fields', () => {
    expect(hasRichProfile(person('a', 'A', { title: 'Dev' }))).toBe(false);
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

describe('nextAlphabeticalNeighbors', () => {
  it('returns the entries that follow the target', () => {
    const list = ['Anna', 'Bruno', 'Carla', 'Davide', 'Eva'].map((n, i) =>
      person(`${i}`, n),
    );
    const target = list[1];
    if (!target) throw new Error('target fixture missing');
    const neighbors = nextAlphabeticalNeighbors(target, list, 3);
    expect(neighbors.map((p) => p.data.name)).toEqual([
      'Carla',
      'Davide',
      'Eva',
    ]);
  });

  it('wraps to the front when the target sits near the end', () => {
    const list = ['Anna', 'Bruno', 'Carla'].map((n, i) => person(`${i}`, n));
    const target = list[2];
    if (!target) throw new Error('target fixture missing');
    const neighbors = nextAlphabeticalNeighbors(target, list, 3);
    expect(neighbors.map((p) => p.data.name)).toEqual(['Anna', 'Bruno']);
  });

  it('returns an empty array for unknown people', () => {
    expect(nextAlphabeticalNeighbors(person('z', 'Zeta'), [], 3)).toEqual([]);
  });
});

describe('roleLabel', () => {
  it('joins role labels in Italian', () => {
    expect(roleLabel(['member', 'speaker'])).toBe('Membro · Speaker');
    expect(roleLabel(['speaker'])).toBe('Speaker');
    expect(roleLabel(['member'])).toBe('Membro');
  });
});

describe('linkKind', () => {
  it.each([
    ['https://www.linkedin.com/in/foo', 'linkedin'],
    ['https://linkedin.com/in/foo', 'linkedin'],
    ['https://x.com/foo', 'twitter'],
    ['https://twitter.com/foo', 'twitter'],
    ['https://github.com/foo', 'github'],
    ['https://mastodon.social/@xe', 'mastodon'],
    ['https://mastodon.online/@xe', 'mastodon'],
    ['https://example.com/page', 'website'],
  ])('classifies %s as %s', (url, expected) => {
    expect(linkKind(url)).toBe(expected);
  });

  it('returns "website" for invalid URLs', () => {
    expect(linkKind('not-a-url')).toBe('website');
  });
});

describe('markdownHeadings', () => {
  it('parses ATX headings and assigns slugs', () => {
    expect(markdownHeadings('# Titolo\n## Ciao\n')).toEqual([
      { id: 'titolo', level: 1, text: 'Titolo' },
      { id: 'ciao', level: 2, text: 'Ciao' },
    ]);
  });

  it('de-duplicates slugs when the same heading repeats', () => {
    expect(
      markdownHeadings('## Ciao\n## Ciao\n## Ciao\n').map((h) => h.id),
    ).toEqual(['ciao', 'ciao-1', 'ciao-2']);
  });

  it('strips trailing closing hashes and whitespace', () => {
    expect(markdownHeadings('## Ciao ###   \n')[0]?.text).toBe('Ciao');
  });

  it('returns an empty array when the content has no headings', () => {
    expect(markdownHeadings('Solo testo.\nAltro testo.\n')).toEqual([]);
  });
});
