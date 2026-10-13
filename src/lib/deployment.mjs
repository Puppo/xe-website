import { legacyPersonSlugs } from './person-slugs.mjs';

export const defaultSiteUrl = 'http://xedotnet.org/';

/** Resolve the public deployment URL from environment variables.
 * Priority: explicit SITE_URL, Netlify DEPLOY_PRIME_URL, Netlify URL, then defaultSiteUrl.
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveSiteUrl(env = process.env) {
  return (
    env.SITE_URL?.trim() ||
    env.DEPLOY_PRIME_URL?.trim() ||
    env.URL?.trim() ||
    defaultSiteUrl
  );
}

/** Resolve the public origin and base path from one deployment URL.
 * @param {string} value
 */
export function deploymentConfig(value) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'SITE_URL deve essere un URL HTTP(S) senza credenziali, query o frammenti.',
    );
  }
  return { base: `${url.pathname.replace(/\/+$/u, '')}/`, site: url.origin };
}

/** Prefix site-relative URLs only; preserve external URLs and page anchors.
 * Content paths are always relative to the site root, never to the deployment.
 * @param {string} path
 * @param {string} base
 */
export function prefixPath(path, base) {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return path;
  }
  return `${base.replace(/\/+$/, '')}${path}`;
}

/** Public paths that must never appear in the sitemap.
 * Relative to the site root, exactly as returned by deploymentConfig base.
 */
export const sitemapExcludedPaths = ['grazie/', '404.html'];

/** Whether a public pathname is one of the sitemap-excluded paths.
 * @param {string} pathname
 * @param {string} base
 */
export function isSitemapExcluded(pathname, base) {
  return (
    sitemapExcludedPaths.some((path) => pathname === `${base}${path}`) ||
    Object.keys(legacyPersonSlugs).some(
      (alias) => pathname === `${base}soci/${alias}/`,
    )
  );
}
