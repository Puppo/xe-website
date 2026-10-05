import type { APIRoute } from 'astro';
import { loadPeopleContext } from '../../../lib/people-content';
import { currentMembers, toMemberDetails } from '../../../lib/people';

export async function getStaticPaths() {
  const { people, context } = await loadPeopleContext();
  return currentMembers(people, context).map((person) => ({
    params: { slug: person.id },
  }));
}

export const GET: APIRoute = async ({ params, site }) => {
  const { people, context } = await loadPeopleContext();
  const person = people.find((candidate) => candidate.id === params.slug);
  const details = person ? toMemberDetails(person, site, context) : undefined;
  return details ? Response.json(details) : new Response(null, { status: 404 });
};
