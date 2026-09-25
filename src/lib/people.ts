import type { CollectionEntry } from 'astro:content';
import { withBase } from './urls';
import { markdownExcerpt } from './text';
import type {
  MemberRole,
  WebMcpMemberDetails,
  WebMcpMemberSummary,
} from './webmcp';

export type PersonEntry = CollectionEntry<'people'>;

export function publishedPeople(people: PersonEntry[]): PersonEntry[] {
  return people.filter(
    (person) => person.data.published && person.data.roles.includes('member'),
  );
}

export type BaseUrl = URL | string | undefined;

interface MembershipLike {
  person: { id: string } | string;
  personEntry?: PersonEntry;
}

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
  person: PersonEntry | MembershipLike,
  baseUrl: BaseUrl,
): WebMcpMemberSummary | undefined {
  if ('data' in person) {
    if (!person.data.published || !person.data.roles.includes('member')) {
      return undefined;
    }
    return toSummary(person, baseUrl);
  }
  if (!person.personEntry) {
    return undefined;
  }
  return toSummary(person.personEntry, baseUrl);
}

function toDetails(person: PersonEntry, baseUrl: BaseUrl): WebMcpMemberDetails {
  const biography = (person.body ?? '').trim();
  return {
    biography: markdownExcerpt(biography, 600),
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
  person: PersonEntry | MembershipLike,
  baseUrl: BaseUrl,
): WebMcpMemberDetails | undefined {
  if ('data' in person) {
    if (!person.data.published || !person.data.roles.includes('member')) {
      return undefined;
    }
    return toDetails(person, baseUrl);
  }
  if (!person.personEntry) {
    return undefined;
  }
  return toDetails(person.personEntry, baseUrl);
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
