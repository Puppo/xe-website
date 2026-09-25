import { prefixPath } from './deployment.mjs';

/** Apply the deployment base to a site-relative content or asset URL. */
export function withBase(path: string): string {
  return prefixPath(path, import.meta.env.BASE_URL);
}

const ABSOLUTE_HTTP = ['http:', 'https:'] as const;

/** Decide whether an href points to a different origin than the public site. */
export function isExternalUrl(
  href: string | undefined,
  siteOrigin: string | undefined,
): boolean {
  if (!href || !siteOrigin) {
    return false;
  }
  if (
    href.startsWith('#') ||
    href.startsWith('?') ||
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../')
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (!(ABSOLUTE_HTTP as readonly string[]).includes(url.protocol)) {
    return false;
  }
  return url.origin !== siteOrigin;
}

/** Anchor attributes that open a link in a new tab when it points outside the site. */
export function externalLinkProps(
  href: string | undefined,
  siteOrigin: string | undefined,
  rel = 'noopener noreferrer',
): { target: '_blank'; rel: string } | Record<string, never> {
  return isExternalUrl(href, siteOrigin) ? { target: '_blank', rel } : {};
}
