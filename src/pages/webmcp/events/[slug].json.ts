import type { APIRoute } from 'astro';
import { getCollection, getEntries } from 'astro:content';
import {
  eventSlug,
  formatEventDate,
  registrationMessage,
  registrationState,
} from '../../../lib/events';
import { withBase } from '../../../lib/urls';
import type { WebMcpEventDetails } from '../../../lib/webmcp';
import { eventMaterials } from '../../../lib/webmcp';

export async function getStaticPaths() {
  const events = await getCollection('events', ({ data }) => !data.draft);
  return events.map((event) => ({ params: { slug: eventSlug(event) } }));
}

export const GET: APIRoute = async ({ params, site }) => {
  const events = await getCollection('events', ({ data }) => !data.draft),
    event = events.find((candidate) => eventSlug(candidate) === params.slug);
  if (!event) {
    return new Response(null, { status: 404 });
  }
  const speakerReferences = event.data.sessions.flatMap(({ speakers }) =>
      speakers.flatMap((speaker) =>
        typeof speaker === 'string' ? [] : [speaker.person],
      ),
    ),
    people = await getEntries(speakerReferences),
    peopleById = new Map(people.map((person) => [person.id, person.data.name])),
    pageUrl = new URL(withBase(`/eventi/${eventSlug(event)}/`), site).href,
    details: WebMcpEventDetails = {
      date: formatEventDate(event.data.date),
      description: event.data.description,
      endDate: event.data.endDate
        ? formatEventDate(event.data.endDate)
        : undefined,
      eventType: event.data.eventType,
      materials: eventMaterials(event.data),
      registration: {
        message: registrationMessage(event),
        url:
          registrationState(event) === 'open'
            ? event.data.registration.url
            : undefined,
      },
      sessions: event.data.sessions.map((session) => ({
        materials: session.materials ?? [],
        speakers: session.speakers.map((speaker) =>
          typeof speaker === 'string'
            ? speaker
            : (peopleById.get(speaker.person.id) ?? speaker.person.id),
        ),
        time: session.time,
        title: session.title,
      })),
      status: event.data.status,
      title: event.data.title,
      url: pageUrl,
      venue: event.data.venue?.name,
    };
  return Response.json(details);
};
