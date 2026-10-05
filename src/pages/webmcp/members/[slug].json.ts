import type { APIRoute } from 'astro';
import { loadPeopleContext } from '../../../lib/people-content';
import {
  legacyPersonSlugs,
  personSlugAliases,
} from '../../../lib/person-slugs.mjs';
import { currentMembers, toMemberDetails } from '../../../lib/people';

export async function getStaticPaths() {
  const { people, context } = await loadPeopleContext();
  return currentMembers(people, context).flatMap((person) =>
    [person.id, ...personSlugAliases(person.id)].map((slug) => ({
      params: { slug },
    })),
  );
}

export const GET: APIRoute = async ({ params, site }) => {
  const { people, context } = await loadPeopleContext();
  const id =
    params.slug && Object.hasOwn(legacyPersonSlugs, params.slug)
      ? legacyPersonSlugs[params.slug]
      : params.slug;
  const person = people.find((candidate) => candidate.id === id);
  const details = person ? toMemberDetails(person, site, context) : undefined;
  return details ? Response.json(details) : new Response(null, { status: 404 });
};
