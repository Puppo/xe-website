import type { CollectionEntry } from 'astro:content';

export type EventEntry = CollectionEntry<'events'>;

export const ROME_TIME_ZONE = 'Europe/Rome';

export type RegistrationState =
  | 'cancelled'
  | 'unavailable'
  | 'not-open'
  | 'open'
  | 'closed';

export function eventTime(event: EventEntry): number {
  return event.data.date.getTime();
}

export function isPastEvent(event: EventEntry, now = new Date()): boolean {
  const end = event.data.endDate ?? event.data.date,
    eventDayEnd = new Date(end);
  eventDayEnd.setUTCHours(23, 59, 59, 999);
  return eventDayEnd.getTime() < now.getTime();
}

export function sortAscending(a: EventEntry, b: EventEntry): number {
  return eventTime(a) - eventTime(b);
}

export function sortDescending(a: EventEntry, b: EventEntry): number {
  return eventTime(b) - eventTime(a);
}

export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: ROME_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: ROME_TIME_ZONE,
    year: 'numeric',
  }).format(date);
}

function calendarDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
      day: '2-digit',
      month: '2-digit',
      timeZone: ROME_TIME_ZONE,
      year: 'numeric',
    }).formatToParts(date),
    value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function eventYear(event: EventEntry): number {
  return Number(
    new Intl.DateTimeFormat('en', {
      timeZone: ROME_TIME_ZONE,
      year: 'numeric',
    }).format(event.data.date),
  );
}

export function eventSlug(event: EventEntry): string {
  const filename = event.id.split('/').at(-1) ?? event.id;
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

export function isCancelled(event: EventEntry): boolean {
  return event.data.status === 'cancelled';
}

export function nextScheduledEvent(
  events: EventEntry[],
): EventEntry | undefined {
  return events.find((event) => !isCancelled(event));
}

export function registrationState(
  event: EventEntry,
  now = new Date(),
): RegistrationState {
  if (isCancelled(event)) {
    return 'cancelled';
  }

  const { startDate, endDate } = event.data.registration,
    today = calendarDateKey(now);
  if (!startDate || !endDate) {
    return today > calendarDateKey(event.data.endDate ?? event.data.date)
      ? 'closed'
      : 'unavailable';
  }

  if (today < calendarDateKey(startDate)) {
    return 'not-open';
  }
  if (today > calendarDateKey(endDate)) {
    return 'closed';
  }
  return 'open';
}

export function registrationMessage(
  event: EventEntry,
  now = new Date(),
): string {
  const state = registrationState(event, now),
    { startDate, endDate } = event.data.registration;

  if (state === 'cancelled') {
    return 'L’evento è stato annullato; le iscrizioni non sono disponibili.';
  }
  if (state === 'unavailable') {
    return 'Le iscrizioni non sono ancora disponibili.';
  }
  if (state === 'not-open' && startDate) {
    return `Le iscrizioni apriranno il ${formatCalendarDate(startDate)}.`;
  }
  if (state === 'open' && endDate) {
    return `Le iscrizioni sono aperte fino al ${formatCalendarDate(endDate)}.`;
  }
  return 'Le iscrizioni sono chiuse.';
}

export function eventStructuredStatus(event: EventEntry): string {
  return isCancelled(event)
    ? 'https://schema.org/EventCancelled'
    : 'https://schema.org/EventScheduled';
}
