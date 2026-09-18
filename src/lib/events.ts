import type { CollectionEntry } from 'astro:content';

export type EventEntry = CollectionEntry<'events'>;

export const ROME_TIME_ZONE = 'Europe/Rome';

export function eventTime(event: EventEntry): number {
  return event.data.date.getTime();
}

export function isPastEvent(event: EventEntry, now = new Date()): boolean {
  const end = event.data.endDate ?? event.data.date;
  const eventDayEnd = new Date(end);
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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ROME_TIME_ZONE
  }).format(date);
}

export function eventYear(event: EventEntry): number {
  return Number(new Intl.DateTimeFormat('en', {
    year: 'numeric',
    timeZone: ROME_TIME_ZONE
  }).format(event.data.date));
}

export function registrationMessage(status: EventEntry['data']['registration']['status']): string {
  return {
    'not-open': 'Le iscrizioni non sono ancora aperte.',
    open: 'Le iscrizioni sono aperte.',
    'sold-out': 'I posti disponibili sono esauriti.',
    closed: 'Le iscrizioni sono chiuse.'
  }[status];
}
