export const EVENT_CATALOG_PAGE_SIZE = 5;
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
