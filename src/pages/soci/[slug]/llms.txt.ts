import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderMemberDetailLlmsTxt } from '../../../lib/llms';
import { currentMembers, isCurrentMember } from '../../../lib/people';
import { loadPeopleContext } from '../../../lib/people-content';
import {
  legacyPersonSlugs,
  personSlugAliases,
} from '../../../lib/person-slugs.mjs';

const HTTP_NOT_FOUND = 404;

export async function getStaticPaths() {
  const { people, context } = await loadPeopleContext();
  return currentMembers(people, context).flatMap((person) =>
    [person.id, ...personSlugAliases(person.id)].map((slug) => ({
      params: { slug },
    })),
  );
}

export const GET: APIRoute = async ({ params, site }) => {
  const [[siteEntry], events, { people, context }] = await Promise.all([
      getCollection('site'),
      getCollection('events', ({ data }) => !data.draft),
      loadPeopleContext(),
    ]),
    id =
      params.slug && Object.hasOwn(legacyPersonSlugs, params.slug)
        ? legacyPersonSlugs[params.slug]
        : params.slug,
    member = people.find(
      (candidate) => candidate.id === id && isCurrentMember(candidate, context),
    );

  if (!member) {
    return new Response(null, { status: HTTP_NOT_FOUND });
  }

  return llmsResponse(
    renderMemberDetailLlmsTxt({
      context,
      events,
      member,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
