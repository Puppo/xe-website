import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderEventsIndexLlmsTxt } from '../../lib/llms';

export const GET: APIRoute = async ({ site }) => {
  const [[siteEntry], events] = await Promise.all([
    getCollection('site'),
    getCollection('events', ({ data }) => !data.draft),
  ]);

  return llmsResponse(
    renderEventsIndexLlmsTxt({
      events,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
