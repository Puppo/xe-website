import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { toMemberDetails } from '../../../lib/people';

export async function getStaticPaths() {
  const people = await getCollection(
    'people',
    ({ data }) => data.published && data.roles.includes('member'),
  );
  return people.map((person) => ({ params: { slug: person.id } }));
}

export const GET: APIRoute = async ({ params, site }) => {
  const person = await getCollection('people').then((people) =>
    people.find((candidate) => candidate.id === params.slug),
  );
  const details = person ? toMemberDetails(person, site) : undefined;
  return details ? Response.json(details) : new Response(null, { status: 404 });
};
