import type {
  WebMcpEventDetails,
  WebMcpFullEvent,
  WebMcpMemberDetails,
  WebMcpMemberSummary,
} from './webmcp';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}
function fields(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  return (
    required.every((key) => typeof value[key] === 'string') &&
    optional.every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    )
  );
}
function materials(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => record(item) && fields(item, ['label', 'url']))
  );
}
function sessions(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        fields(item, ['title'], ['description', 'time']) &&
        strings(item.speakers) &&
        (item.materials === undefined || materials(item.materials)),
    )
  );
}
function eventFields(value: Record<string, unknown>): boolean {
  return (
    fields(
      value,
      ['date', 'description', 'title', 'url'],
      ['endDate', 'eventType', 'venue'],
    ) &&
    ['scheduled', 'cancelled'].includes(String(value.status)) &&
    materials(value.materials) &&
    sessions(value.sessions) &&
    record(value.registration) &&
    fields(value.registration, [], ['startDate', 'endDate', 'url'])
  );
}
export function isEventCatalog(value: unknown): value is WebMcpFullEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        eventFields(item) &&
        fields(item, ['slug', 'body']) &&
        typeof item.year === 'number' &&
        ['past', 'upcoming'].includes(String(item.period)) &&
        (item.speakers === undefined || strings(item.speakers)),
    )
  );
}
export function isEventDetails(value: unknown): value is WebMcpEventDetails {
  return (
    record(value) &&
    eventFields(value) &&
    fields(value, ['sourceDate'], ['sourceEndDate']) &&
    record(value.registration) &&
    fields(value.registration, ['message'], ['sourceUrl'])
  );
}
function memberFields(value: Record<string, unknown>): boolean {
  return (
    fields(
      value,
      ['slug', 'name', 'excerpt', 'url'],
      ['title', 'profileUrl'],
    ) &&
    strings(value.roles) &&
    value.roles.every((role) => ['member', 'speaker'].includes(role)) &&
    materials(value.externalLinks)
  );
}
export function isMemberCatalog(
  value: unknown,
): value is WebMcpMemberSummary[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        memberFields(item) &&
        typeof item.hasBiography === 'boolean' &&
        typeof item.hasImage === 'boolean',
    )
  );
}
export function isMemberDetails(value: unknown): value is WebMcpMemberDetails {
  return (
    record(value) &&
    memberFields(value) &&
    fields(value, ['biography'], ['fullBiography'])
  );
}
