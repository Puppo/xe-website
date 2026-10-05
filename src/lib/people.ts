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

type SpeakerReference = string | { person: string | { id: string } };

interface SpeakerEvent {
  data: {
    draft: boolean;
    sessions: { speakers: SpeakerReference[] }[];
  };
}

function speakerPersonId(speaker: SpeakerReference): string | undefined {
  if (typeof speaker === 'string') {
    return undefined;
  }
  return typeof speaker.person === 'string'
    ? speaker.person
    : speaker.person.id;
}

/** Published event references establish speaker status, independently of membership. */
export function createSpeakerIds(
  events: readonly SpeakerEvent[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.data.draft) {
      continue;
    }
    for (const session of event.data.sessions) {
      for (const speaker of session.speakers) {
        const id = speakerPersonId(speaker);
        if (id !== undefined) {
          ids.add(id);
        }
      }
    }
  }
  return ids;
}

/** Up to `limit` most-recent events where the given member spoke. */
export function recentEventsForPerson(
  person: PersonEntry,
  events: TalkEvent[],
  limit = DEFAULT_NEIGHBORS,
): TalkEvent[] {
  return events
    .filter(
      (event) =>
        !event.data.draft &&
        event.data.sessions.some((session) =>
          session.speakers.some(
            (speaker) => speakerPersonId(speaker) === person.id,
          ),
        ),
    )
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(NO_INDEX, limit);
}

export interface MembershipContext {
  year: number;
  memberIds: ReadonlySet<string>;
}

export interface PeopleContext extends MembershipContext {
  speakerIds: ReadonlySet<string>;
}

/** Validate all years before selecting the latest available list. */
export function createMembershipContext(
  memberships: CollectionEntry<'memberships'>[],
  people: PersonEntry[],
): MembershipContext {
  const peopleIds = new Set(people.map((person) => person.id));
  let latest: CollectionEntry<'memberships'> | undefined;
  for (const membership of memberships) {
    if (!/^\d{4}$/u.test(membership.id)) {
      throw new Error(
        `L’anno associativo "${membership.id}" deve avere quattro cifre.`,
      );
    }
    for (const member of membership.data.members) {
      if (!peopleIds.has(member.id)) {
        throw new Error(
          `Anno associativo ${membership.id}: il socio "${member.id}" non ha un profilo.`,
        );
      }
    }
    if (!latest || Number(membership.id) > Number(latest.id)) {
      latest = membership;
    }
  }
  if (!latest) {
    throw new Error(
      'Manca un elenco annuale dei soci in src/data/memberships/.',
    );
  }
  return {
    year: Number(latest.id),
    memberIds: new Set(latest.data.members.map((member) => member.id)),
  };
}

export function isCurrentMember(
  person: PersonEntry,
  membership: MembershipContext,
): boolean {
  return person.data.published && membership.memberIds.has(person.id);
}

export function currentMembers(
  people: PersonEntry[],
  membership: MembershipContext,
): PersonEntry[] {
  return people.filter((person) => isCurrentMember(person, membership));
}

export type BaseUrl = URL | string | undefined;

function personRoles(
  person: PersonEntry,
  context: PeopleContext,
): MemberRole[] {
  return [
    ...(context.memberIds.has(person.id) ? ['member' as const] : []),
    ...(context.speakerIds.has(person.id) ? ['speaker' as const] : []),
  ];
}

function personProfileUrl(baseUrl: BaseUrl, person: PersonEntry): string {
  return new URL(withBase(`/soci/${person.id}/`), baseUrl).href;
}

function toSummary(
  person: PersonEntry,
  baseUrl: BaseUrl,
  context: PeopleContext,
): WebMcpMemberSummary {
  const biography = (person.body ?? '').trim();
  return {
    excerpt: markdownExcerpt(biography),
    externalLinks: person.data.links,
    hasBiography: biography.length > 0,
    hasImage: Boolean(person.data.image),
    name: person.data.name,
    profileUrl: person.data.profileUrl,
    roles: personRoles(person, context),
    slug: person.id,
    title: person.data.title,
    url: personProfileUrl(baseUrl, person),
  };
}

export function toMemberSummary(
  person: PersonEntry,
  baseUrl: BaseUrl,
  context: PeopleContext,
): WebMcpMemberSummary | undefined {
  if (!isCurrentMember(person, context)) {
    return undefined;
  }
  return toSummary(person, baseUrl, context);
}

function toDetails(
  person: PersonEntry,
  baseUrl: BaseUrl,
  context: PeopleContext,
): WebMcpMemberDetails {
  const biography = (person.body ?? '').trim();
  return {
    biography: markdownExcerpt(biography, BIOGRAPHY_EXCERPT_LENGTH),
    excerpt: markdownExcerpt(biography),
    externalLinks: person.data.links,
    name: person.data.name,
    profileUrl: person.data.profileUrl,
    roles: personRoles(person, context),
    slug: person.id,
    title: person.data.title,
    url: personProfileUrl(baseUrl, person),
  };
}

export function toMemberDetails(
  person: PersonEntry,
  baseUrl: BaseUrl,
  context: PeopleContext,
): WebMcpMemberDetails | undefined {
  if (!isCurrentMember(person, context)) {
    return undefined;
  }
  return toDetails(person, baseUrl, context);
}

export function memberSummaries(
  people: PersonEntry[],
  baseUrl: BaseUrl,
  context: PeopleContext,
): WebMcpMemberSummary[] {
  return currentMembers(people, context)
    .map((person) => toMemberSummary(person, baseUrl, context))
    .filter((summary): summary is WebMcpMemberSummary => Boolean(summary));
}

export function toMemberCatalog(
  person: PersonEntry,
  baseUrl: BaseUrl,
  context: PeopleContext,
): WebMcpMemberSummary[] | undefined {
  const summary = toMemberSummary(person, baseUrl, context);
  return summary ? [summary] : undefined;
}
