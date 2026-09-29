import type { CollectionEntry } from 'astro:content';
import { markdownExcerpt } from './text';
import { withBase } from './urls';
import type {
  MemberRole,
  WebMcpMemberDetails,
  WebMcpMemberSummary,
} from './webmcp';

export type PersonEntry = CollectionEntry<'people'>;
export type TalkEvent = CollectionEntry<'events'>;

const NO_INDEX = 0;
const DEFAULT_NEIGHBORS = 3;
const ITALIAN_INITIAL = new Intl.Collator('it-IT', { sensitivity: 'base' });
const HONORARY_PREFIX = /^(Avv\.?|Dott\.?)\s+/iu;
const DIACRITIC_RANGE = /[̀-ͯ]/gu;
const BIOGRAPHY_EXCERPT_LENGTH = 600;

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

export function publishedPeople(people: PersonEntry[]): PersonEntry[] {
  return people.filter(
    (person) => person.data.published && person.data.roles.includes('member'),
  );
}

export type BaseUrl = URL | string | undefined;

function personRoles(person: PersonEntry): MemberRole[] {
  return person.data.roles.filter((role): role is MemberRole =>
    ['member', 'speaker'].includes(role),
  );
}

function personProfileUrl(baseUrl: BaseUrl, person: PersonEntry): string {
  return new URL(withBase(`/soci/${person.id}/`), baseUrl).href;
}

function toSummary(person: PersonEntry, baseUrl: BaseUrl): WebMcpMemberSummary {
  const biography = (person.body ?? '').trim();
  return {
    excerpt: markdownExcerpt(biography),
    externalLinks: person.data.links,
    hasBiography: biography.length > 0,
    hasImage: Boolean(person.data.image),
    name: person.data.name,
    profileUrl: person.data.profileUrl,
    roles: personRoles(person),
    slug: person.id,
    title: person.data.title,
    url: personProfileUrl(baseUrl, person),
  };
}

export function toMemberSummary(
  person: PersonEntry,
  baseUrl: BaseUrl,
): WebMcpMemberSummary | undefined {
  if (!person.data.published || !person.data.roles.includes('member')) {
    return undefined;
  }
  return toSummary(person, baseUrl);
}

function toDetails(person: PersonEntry, baseUrl: BaseUrl): WebMcpMemberDetails {
  const biography = (person.body ?? '').trim();
  return {
    biography: markdownExcerpt(biography, BIOGRAPHY_EXCERPT_LENGTH),
    excerpt: markdownExcerpt(biography),
    externalLinks: person.data.links,
    name: person.data.name,
    profileUrl: person.data.profileUrl,
    roles: personRoles(person),
    slug: person.id,
    title: person.data.title,
    url: personProfileUrl(baseUrl, person),
  };
}

export function toMemberDetails(
  person: PersonEntry,
  baseUrl: BaseUrl,
): WebMcpMemberDetails | undefined {
  if (!person.data.published || !person.data.roles.includes('member')) {
    return undefined;
  }
  return toDetails(person, baseUrl);
}

export function memberSummaries(
  people: PersonEntry[],
  baseUrl: BaseUrl,
): WebMcpMemberSummary[] {
  return publishedPeople(people)
    .map((person) => toMemberSummary(person, baseUrl))
    .filter((summary): summary is WebMcpMemberSummary => Boolean(summary));
}

export function toMemberCatalog(
  person: PersonEntry,
  baseUrl: BaseUrl,
): WebMcpMemberSummary[] | undefined {
  const summary = toMemberSummary(person, baseUrl);
  return summary ? [summary] : undefined;
}
