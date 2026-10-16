import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderMembersIndexLlmsTxt } from '../../lib/llms';
import { loadPeopleContext } from '../../lib/people-content';

export const GET: APIRoute = async ({ site }) => {
  const [[siteEntry], { people, context }] = await Promise.all([
    getCollection('site'),
    loadPeopleContext(),
  ]);

  return llmsResponse(
    renderMembersIndexLlmsTxt({
      context,
      people,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
