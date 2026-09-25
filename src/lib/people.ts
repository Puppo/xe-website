import type { CollectionEntry } from 'astro:content';

export type PersonEntry = CollectionEntry<'people'>;
export type TalkEvent = CollectionEntry<'events'>;

const NO_INDEX = 0;
const NOT_FOUND = -1;
const FIRST_STEP = 1;
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

/** Whether the entry satisfies the soft "rich-profile" filter used by the homepage strip. */
export function hasRichProfile(person: PersonEntry): boolean {
  const hasImage = Boolean(person.data.image),
    hasLinks = person.data.links.length > NO_INDEX,
    hasTitle = Boolean(person.data.title);
  return hasImage && (hasTitle || hasLinks);
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

/** Pick `count` members that follow the given one alphabetically, wrapping the list. */
export function nextAlphabeticalNeighbors(
  person: PersonEntry,
  all: PersonEntry[],
  count = DEFAULT_NEIGHBORS,
): PersonEntry[] {
  if (count <= NO_INDEX) {
    return [];
  }
  const sorted = [...all].sort((a, b) =>
      a.data.sortName.localeCompare(b.data.sortName, 'it'),
    ),
    index = sorted.findIndex((entry) => entry.id === person.id),
    out: PersonEntry[] = [];
  if (index === NOT_FOUND) {
    return out;
  }
  for (
    let step = FIRST_STEP;
    step <= sorted.length && out.length < count;
    step++
  ) {
    const candidate = sorted[(index + step) % sorted.length];
    if (candidate && candidate.id !== person.id) {
      out.push(candidate);
    }
  }
  return out;
}

const ROLE_LABELS: Record<string, string> = {
  member: 'Membro',
  speaker: 'Speaker',
};

/** Italian, separator-joined role label. */
export function roleLabel(roles: readonly string[]): string {
  return roles.map((role) => ROLE_LABELS[role] ?? role).join(' · ');
}

export type LinkKind =
  | 'linkedin'
  | 'twitter'
  | 'github'
  | 'mastodon'
  | 'website';

/** Best-effort classification of a link's host so the UI can label the chip. */
export function linkKind(url: string): LinkKind {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'website';
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com'))
    return 'linkedin';
  if (
    host === 'x.com' ||
    host === 'twitter.com' ||
    host.endsWith('.twitter.com')
  )
    return 'twitter';
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (
    host.endsWith('mastodon.social') ||
    host.endsWith('.mastodon.online') ||
    host.includes('mastodon.')
  ) {
    return 'mastodon';
  }
  return 'website';
}

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  mastodon: 'Mastodon',
  twitter: 'Twitter',
  website: 'Sito',
};
