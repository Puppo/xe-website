import type { APIRoute } from 'astro';
import { withBase } from '../lib/urls';

export const GET: APIRoute = ({ site }) => {
  const noindex = import.meta.env.PUBLIC_NOINDEX;
  const policy = noindex ? 'Disallow: /' : 'Allow: /';
  const sitemap = new URL(withBase('/sitemap-index.xml'), site).href;

  return new Response(`User-agent: *\n${policy}\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
