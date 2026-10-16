import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderContactLlmsTxt } from '../../lib/llms';

export const GET: APIRoute = async ({ site }) => {
  const [siteEntry] = await getCollection('site');

  return llmsResponse(
    renderContactLlmsTxt({
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
