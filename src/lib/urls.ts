import { prefixPath } from './deployment.mjs';

/** Apply the deployment base to a site-relative content or asset URL. */
export function withBase(path: string): string {
  return prefixPath(path, import.meta.env.BASE_URL);
}
