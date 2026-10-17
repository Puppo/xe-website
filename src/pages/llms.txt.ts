import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderRootLlmsTxt } from '../lib/llms';
import { loadPeopleContext } from '../lib/people-content';

export const GET: APIRoute = async ({ site }) => {
  const [[siteEntry], events, { people, context }] = await Promise.all([
    getCollection('site'),
    getCollection('events', ({ data }) => !data.draft),
    loadPeopleContext(),
  ]);

  return llmsResponse(
    renderRootLlmsTxt({
      context,
      events,
      people,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
