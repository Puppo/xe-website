import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { llmsResponse, renderPrivacyLlmsTxt } from '../../lib/llms';

export const GET: APIRoute = async ({ site }) => {
  const [[page], [siteEntry]] = await Promise.all([
    getCollection('pages', ({ id }) => id === 'privacy-policy'),
    getCollection('site'),
  ]);

  return llmsResponse(
    renderPrivacyLlmsTxt({
      page,
      site: siteEntry.data,
      siteUrl: site,
    }),
  );
};
