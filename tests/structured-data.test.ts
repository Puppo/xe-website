import { describe, expect, it } from 'vitest';
import { breadcrumbList } from '../src/lib/structured-data';

describe('breadcrumbList', () => {
  it('produce una BreadcrumbList con posizioni progressive', () => {
    const result = breadcrumbList([
      { name: 'Home', url: 'https://www.xedotnet.org/' },
      { name: 'Eventi', url: 'https://www.xedotnet.org/eventi/' },
      { name: '2026', url: 'https://www.xedotnet.org/eventi/2026/' },
    ]) as {
      '@type': string;
      itemListElement: { position: number; name: string; item: string }[];
    };

    expect(result['@type']).toBe('BreadcrumbList');
    expect(result.itemListElement).toHaveLength(3);
    expect(result.itemListElement.map((item) => item.position)).toEqual([
      1, 2, 3,
    ]);
    expect(result.itemListElement[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: '2026',
      item: 'https://www.xedotnet.org/eventi/2026/',
    });
  });

  it('gestisce una lista vuota', () => {
    const result = breadcrumbList([]) as { itemListElement: unknown[] };
    expect(result.itemListElement).toEqual([]);
  });
});
