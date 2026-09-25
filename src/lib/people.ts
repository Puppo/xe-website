import type { CollectionEntry } from 'astro:content';

export type PersonEntry = CollectionEntry<'people'>;
export type TalkEvent = CollectionEntry<'events'>;

const NO_INDEX = 0;
const DEFAULT_NEIGHBORS = 3;
const ITALIAN_INITIAL = new Intl.Collator('it-IT', { sensitivity: 'base' });
const HONORARY_PREFIX = /^(Avv\.?|Dott\.?)\s+/iu;
const DIACRITIC_RANGE = /[̀-ͯ]/gu;

export interface LetterBand {
  letter: string;
  items: PersonEntry[];
}

function firstInitial(name: string): string {
  const trimmed = name.trim().replace(HONORARY_PREFIX, ''),
    folded = (trimmed.charAt(0) || '')
      .normalize('NFD')
      .replaceAll(DIACRITIC_RANGE, '');
  return folded.toLocaleUpperCase('it-IT');
}

/** Group people by the first diacritic-aware letter of their display name. */
export function groupByInitial(people: PersonEntry[]): LetterBand[] {
  const buckets = new Map<string, PersonEntry[]>();
  for (const person of people) {
    const letter = firstInitial(person.data.name),
      bucket = buckets.get(letter) ?? [];
    bucket.push(person);
    buckets.set(letter, bucket);
  }
  return [...buckets.entries()]
    .map(([letter, items]) => ({ letter, items }))
    .sort((a, b) => ITALIAN_INITIAL.compare(a.letter, b.letter));
}

function matchesSpeaker(speaker: unknown, personId: string): boolean {
  if (typeof speaker === 'string') {
    return speaker === personId;
  }
  if (speaker && typeof speaker === 'object' && 'person' in speaker) {
    const candidate = (speaker as { person: unknown }).person;
    if (typeof candidate === 'string') {
      return candidate === personId;
    }
    if (candidate && typeof candidate === 'object' && 'id' in candidate) {
      return (candidate as { id: unknown }).id === personId;
    }
  }
  return false;
}

/** Up to `limit` most-recent events where the given member spoke. */
export function recentEventsForPerson(
  person: PersonEntry,
  events: TalkEvent[],
  limit = DEFAULT_NEIGHBORS,
): TalkEvent[] {
  return events
    .filter((event) =>
      event.data.sessions.some((session) =>
        session.speakers.some((speaker) => matchesSpeaker(speaker, person.id)),
      ),
    )
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(NO_INDEX, limit);
}
