import type { APIRoute } from 'astro';
import { loadMemberships } from '../../../lib/memberships';
import { currentMembers, toMemberDetails } from '../../../lib/people';

export async function getStaticPaths() {
  const { people, membership } = await loadMemberships();
  return currentMembers(people, membership).map((person) => ({
    params: { slug: person.id },
  }));
}

export const GET: APIRoute = async ({ params, site }) => {
  const { people, membership } = await loadMemberships();
  const person = people.find((candidate) => candidate.id === params.slug);
  const details = person
    ? toMemberDetails(person, site, membership)
    : undefined;
  return details ? Response.json(details) : new Response(null, { status: 404 });
};
