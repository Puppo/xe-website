import { prefixPath } from '../src/lib/deployment.mjs';

/** Keep Markdown content portable between root and subdirectory deployments. */
export default function rehypeBaseUrls({ base = '/' } = {}) {
  return function transform(node) {
    if (node.type === 'element') {
      for (const attribute of ['href', 'src', 'poster']) {
        const value = node.properties?.[attribute];
        if (typeof value === 'string') {
          node.properties[attribute] = prefixPath(value, base);
        }
      }
    }
    for (const child of node.children ?? []) {
      transform(child);
    }
  };
}
