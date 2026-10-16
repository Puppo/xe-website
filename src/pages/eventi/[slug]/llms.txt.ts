import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { eventSlug, eventYear } from '../../../lib/events';
import {
  llmsResponse,
  renderEventDetailLlmsTxt,
  renderEventsYearLlmsTxt,
} from '../../../lib/llms';
import { loadPeopleContext } from '../../../lib/people-content';

const HTTP_NOT_FOUND = 404;

export async function getStaticPaths() {
  const events = await getCollection('events', ({ data }) => !data.draft),
    years = [...new Set(events.map(eventYear))];
  return [
    ...events.map((event) => ({ params: { slug: eventSlug(event) } })),
    ...years.map((year) => ({ params: { slug: String(year) } })),
  ];
}

export const GET: APIRoute = async ({ params, site }) => {
  const { slug } = params;
  if (!slug) {
    return new Response(null, { status: HTTP_NOT_FOUND });
  }
  const [[siteEntry], events, { people, context }] = await Promise.all([
    getCollection('site'),
    getCollection('events', ({ data }) => !data.draft),
    loadPeopleContext(),
  ]);

  if (/^\d{4}$/u.test(slug)) {
    const year = Number(slug),
      yearEvents = events.filter((event) => eventYear(event) === year);
    if (yearEvents.length === 0) {
      return new Response(null, { status: HTTP_NOT_FOUND });
    }
    return llmsResponse(
      renderEventsYearLlmsTxt({
        events: yearEvents,
        site: siteEntry.data,
        siteUrl: site,
        year,
      }),
    );
  }

  const event = events.find((candidate) => eventSlug(candidate) === slug);
  if (!event) {
    return new Response(null, { status: HTTP_NOT_FOUND });
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
  return llmsResponse(
    renderEventDetailLlmsTxt({
      context,
      event,
      peopleById,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
