import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderAboutLlmsTxt } from '../../lib/llms';

export const GET: APIRoute = async ({ site }) => {
  const [[page], [siteEntry], locations] = await Promise.all([
    getCollection('pages', ({ id }) => id === 'chi-siamo'),
    getCollection('site'),
    getCollection('locations'),
  ]);

  return llmsResponse(
    renderAboutLlmsTxt({
      locations,
      page,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
