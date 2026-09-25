export const EVENT_CATALOG_PAGE_SIZE = 5;
export const MEMBER_CATALOG_PAGE_SIZE = 5;
export const WEBMCP_OUTPUT_CHARACTER_LIMIT = 1500;

export type EventPeriod = 'all' | 'past' | 'upcoming';

export interface WebMcpEventSummary {
  date: string;
  description: string;
  eventType?: string;
  period: Exclude<EventPeriod, 'all'>;
  slug: string;
  status: 'cancelled' | 'scheduled';
  title: string;
  url: string;
  venue?: string;
  year: number;
}

export interface WebMcpEventDetails {
  date: string;
  description: string;
  endDate?: string;
  eventType?: string;
  materials: { label: string; url: string }[];
  registration: { message: string; url?: string };
  sessions: { speakers: string[]; time?: string; title: string }[];
  status: 'cancelled' | 'scheduled';
  title: string;
  url: string;
  venue?: string;
}

export interface EventCatalogInput {
  offset?: number;
  period?: EventPeriod;
  query?: string;
  year?: number;
}

export type MemberRole = 'member' | 'speaker';

export interface WebMcpMemberSummary {
  excerpt: string;
  externalLinks: { label: string; url: string }[];
  hasBiography: boolean;
  hasImage: boolean;
  name: string;
  profileUrl?: string;
  roles: MemberRole[];
  slug: string;
  title?: string;
  url: string;
}

export interface WebMcpMemberDetails {
  biography: string;
  excerpt: string;
  externalLinks: { label: string; url: string }[];
  name: string;
  profileUrl?: string;
  roles: MemberRole[];
  slug: string;
  title?: string;
  url: string;
}

export interface MemberCatalogInput {
  offset?: number;
  query?: string;
  role?: MemberRole | 'both';
}

function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

export function listEvents(
  catalog: WebMcpEventSummary[],
  input: EventCatalogInput,
) {
  const offset = input.offset ?? 0,
    period = input.period ?? 'all',
    query = input.query?.trim().toLocaleLowerCase('it-IT');

  if (!Number.isInteger(offset) || offset < 0) {
    throw new TypeError(
      'L’offset deve essere un intero maggiore o uguale a zero.',
    );
  }
  if (input.year !== undefined && !Number.isInteger(input.year)) {
    throw new TypeError('L’anno deve essere un numero intero.');
  }

  const matches = catalog.filter((event) => {
      if (period !== 'all' && event.period !== period) {
        return false;
      }
      if (input.year !== undefined && event.year !== input.year) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [event.title, event.description, event.eventType, event.venue]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase('it-IT').includes(query));
    }),
    events = matches
      .slice(offset, offset + EVENT_CATALOG_PAGE_SIZE)
      .map(({ period: _period, year: _year, ...event }) => ({
        ...event,
        description: truncate(event.description, 120),
      })),
    nextOffset =
      offset + EVENT_CATALOG_PAGE_SIZE < matches.length
        ? offset + EVENT_CATALOG_PAGE_SIZE
        : null;

  return { events, nextOffset, offset, total: matches.length };
}

export function eventForSlug(
  catalog: WebMcpEventSummary[],
  slug: unknown,
): WebMcpEventSummary {
  if (typeof slug !== 'string') {
    throw new TypeError('Lo slug dell’evento è obbligatorio.');
  }
  const event = catalog.find((candidate) => candidate.slug === slug);
  if (!event) {
    throw new TypeError(
      'Evento non trovato. Usa list_events per ottenere uno slug valido.',
    );
  }
  return event;
}

export function listMembers(
  catalog: WebMcpMemberSummary[],
  input: MemberCatalogInput,
) {
  const offset = input.offset ?? 0,
    role = input.role ?? 'both',
    query = input.query?.trim().toLocaleLowerCase('it-IT');

  if (!Number.isInteger(offset) || offset < 0) {
    throw new TypeError(
      'L’offset deve essere un intero maggiore o uguale a zero.',
    );
  }

  const matches = catalog.filter((member) => {
      if (role !== 'both' && !member.roles.includes(role)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [member.name, member.title, member.excerpt]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase('it-IT').includes(query));
    }),
    members = matches
      .slice(offset, offset + MEMBER_CATALOG_PAGE_SIZE)
      .map(
        ({
          roles: _roles,
          hasImage: _hasImage,
          hasBiography: _hasBiography,
          ...member
        }) => ({
          ...member,
          excerpt: truncate(member.excerpt, 120),
        }),
      ),
    nextOffset =
      offset + MEMBER_CATALOG_PAGE_SIZE < matches.length
        ? offset + MEMBER_CATALOG_PAGE_SIZE
        : null;

  return { members, nextOffset, offset, total: matches.length };
}

export function memberForSlug(
  catalog: WebMcpMemberSummary[],
  slug: unknown,
): WebMcpMemberSummary {
  if (typeof slug !== 'string') {
    throw new TypeError('Lo slug del socio è obbligatorio.');
  }
  const member = catalog.find((candidate) => candidate.slug === slug);
  if (!member) {
    throw new TypeError(
      'Socio non trovato. Usa list_members per ottenere uno slug valido.',
    );
  }
  return member;
}

export function describeMember(
  member: WebMcpMemberDetails,
  maximum = WEBMCP_OUTPUT_CHARACTER_LIMIT,
): string {
  const roleLabels: Record<MemberRole, string> = {
      member: 'socio',
      speaker: 'relatore',
    },
    roles = member.roles.map((role) => roleLabels[role]).join(' e '),
    lines = [
      `Nome: ${member.name}`,
      member.title ? `Titolo: ${member.title}` : undefined,
      `Ruolo: ${roles}`,
      member.profileUrl ? `Profilo esterno: ${member.profileUrl}` : undefined,
      `Pagina: ${member.url}`,
    ].filter((line): line is string => Boolean(line)),
    optionalLines: string[] = [];

  if (member.biography.trim().length > 0) {
    optionalLines.push(`Biografia (${truncate(member.biography, 360)})`);
  }
  if (member.externalLinks.length > 0) {
    optionalLines.push(`Collegamenti (${member.externalLinks.length}):`);
    for (const link of member.externalLinks) {
      optionalLines.push(`- ${link.label}: ${link.url}`);
    }
  }

  let result = lines.join('\n'),
    omitted = 0;
  for (const line of optionalLines) {
    if (`${result}\n${line}`.length <= maximum - 40) {
      result += `\n${line}`;
    } else {
      omitted += 1;
    }
  }
  if (omitted > 0) {
    result += `\n… ${omitted} dettagli omessi; consulta la pagina del socio.`;
  }
  return truncate(result, maximum);
}

export function describeEvent(
  event: WebMcpEventDetails,
  maximum = WEBMCP_OUTPUT_CHARACTER_LIMIT,
): string {
  const lines = [
      `Titolo: ${event.title}`,
      `Stato: ${event.status === 'cancelled' ? 'annullato' : 'programmato'}`,
      `Data: ${event.date}${event.endDate ? ` – ${event.endDate}` : ''}`,
      event.eventType ? `Tipo: ${event.eventType}` : undefined,
      event.venue ? `Luogo: ${event.venue}` : undefined,
      `Descrizione: ${truncate(event.description, 360)}`,
      `Iscrizione: ${truncate(event.registration.message, 240)}${event.registration.url ? ` ${event.registration.url}` : ''}`,
      `URL: ${event.url}`,
    ].filter((line): line is string => Boolean(line)),
    optionalLines: string[] = [];

  if (event.sessions.length > 0) {
    optionalLines.push(`Programma (${event.sessions.length} sessioni):`);
    for (const session of event.sessions) {
      const speakers =
        session.speakers.length > 0 ? ` — ${session.speakers.join(', ')}` : '';
      optionalLines.push(
        `- ${session.time ? `${session.time}: ` : ''}${session.title}${speakers}`,
      );
    }
  }
  if (event.materials.length > 0) {
    optionalLines.push(`Materiali (${event.materials.length}):`);
    for (const material of event.materials) {
      optionalLines.push(`- ${material.label}: ${material.url}`);
    }
  }

  let result = lines.join('\n'),
    omitted = 0;
  for (const line of optionalLines) {
    if (`${result}\n${line}`.length <= maximum - 40) {
      result += `\n${line}`;
    } else {
      omitted += 1;
    }
  }
  if (omitted > 0) {
    result += `\n… ${omitted} dettagli omessi; consulta la pagina dell’evento.`;
  }
  return truncate(result, maximum);
}

export function registerWebMcpTools(tools: WebMCP.ModelContextTool[]): void {
  if (!('modelContext' in document) || !document.modelContext?.registerTool) {
    return;
  }

  const controller = new AbortController();
  for (const tool of tools) {
    void document.modelContext
      .registerTool(tool, { signal: controller.signal })
      .catch(() => undefined);
  }
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
}

export function fillControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  control.value = value;
  // Native HTML5 form validation reacts to both `input` and `change`,
  // so framework-specific synthetic events are unnecessary.
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

export function requiredString(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Il parametro “${key}” è obbligatorio.`);
  }
  return value.trim();
}

/**
 * Serialize a value as JSON for embedding inside an Astro
 * `<script type="application/json">` block. Escapes characters that would
 * either close the script tag (`<`) or re-interpret its content (`&`), plus
 * U+2028 / U+2029 which JSON.parse tolerates but older JS engines embedded
 * in script tags reject.
 */
export function safeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '<')
    .replaceAll('&', '&')
    .replaceAll(' ', ' ')
    .replaceAll(' ', ' ');
}

/**
 * Defensively parse a `<script type="application/json">` block that should
 * carry an event catalog. Returns `undefined` for missing, empty,
 * non-JSON, or wrong-shape content so callers can skip tool registration
 * without throwing out of a script tag.
 */
export function parseCatalog(
  element: HTMLScriptElement | null | undefined,
): WebMcpEventSummary[] | undefined {
  if (!element?.textContent) {
    return undefined;
  }
  try {
    const value = JSON.parse(element.textContent);
    return Array.isArray(value) ? (value as WebMcpEventSummary[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Defensively parse a `<script type="application/json">` block that should
 * carry event details. Returns `undefined` for missing, empty, non-JSON,
 * or wrong-shape content (a `title` field is required).
 */
export function parseDetails(
  element: HTMLScriptElement | null | undefined,
): WebMcpEventDetails | undefined {
  if (!element?.textContent) {
    return undefined;
  }
  try {
    const value = JSON.parse(element.textContent);
    return typeof value === 'object' && value !== null && 'title' in value
      ? (value as WebMcpEventDetails)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Defensively parse a `<script type="application/json">` block that should
 * carry a member catalog. Returns `undefined` for missing, empty, non-JSON,
 * or wrong-shape content so callers can skip tool registration without
 * throwing out of a script tag.
 */
export function parseMemberCatalog(
  element: HTMLScriptElement | null | undefined,
): WebMcpMemberSummary[] | undefined {
  if (!element?.textContent) {
    return undefined;
  }
  try {
    const value = JSON.parse(element.textContent);
    return Array.isArray(value) ? (value as WebMcpMemberSummary[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Defensively parse a `<script type="application/json">` block that should
 * carry member details. Returns `undefined` for missing, empty, non-JSON,
 * or wrong-shape content (a `name` field is required).
 */
export function parseMemberDetails(
  element: HTMLScriptElement | null | undefined,
): WebMcpMemberDetails | undefined {
  if (!element?.textContent) {
    return undefined;
  }
  try {
    const value = JSON.parse(element.textContent);
    return typeof value === 'object' && value !== null && 'name' in value
      ? (value as WebMcpMemberDetails)
      : undefined;
  } catch {
    return undefined;
  }
}
