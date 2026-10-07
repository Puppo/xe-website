import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  eventSlug,
  eventYear,
  isPastEvent,
  sortDescending,
} from '../../lib/events';
import { withBase } from '../../lib/urls';
import type { WebMcpFullEvent } from '../../lib/webmcp';
import { eventMaterials } from '../../lib/webmcp';

export const GET: APIRoute = async ({ site }) => {
  const [events, people] = await Promise.all([
      getCollection('events', ({ data }) => !data.draft),
      getCollection('people'),
    ]),
    namesById = new Map(people.map((person) => [person.id, person.data.name])),
    catalog: WebMcpFullEvent[] = events.sort(sortDescending).map((event) => {
      const slug = eventSlug(event),
        sessions = event.data.sessions.map((session) => ({
          description: session.description,
          materials: session.materials ?? [],
          speakers: session.speakers.map((speaker) =>
            typeof speaker === 'string'
              ? speaker
              : (namesById.get(speaker.person.id) ?? speaker.person.id),
          ),
          time: session.time,
          title: session.title,
        }));
      return {
        body: event.body ?? '',
        date: event.data.date.toISOString(),
        description: event.data.description,
        endDate: event.data.endDate?.toISOString(),
        eventType: event.data.eventType,
        materials: eventMaterials(event.data),
        period: isPastEvent(event) ? 'past' : 'upcoming',
        registration: {
          startDate: event.data.registration.startDate?.toISOString(),
          endDate: event.data.registration.endDate?.toISOString(),
          url: event.data.registration.url,
        },
        sessions,
        slug,
        speakers: [...new Set(sessions.flatMap((session) => session.speakers))],
        status: event.data.status,
        title: event.data.title,
        url: new URL(withBase(`/eventi/${slug}/`), site).href,
        venue: event.data.venue?.name,
        year: eventYear(event),
      };
    });

  return Response.json(catalog);
};
