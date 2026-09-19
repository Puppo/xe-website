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
  return { base: `${url.pathname.replace(/\/+$/, '')}/`, site: url.origin };
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
