import { describe, expect, it } from 'vitest';
import { paginateItems, paginateText } from '../src/lib/webmcp-pagination';

describe('paginazione WebMCP entro il limite serializzato', () => {
  it('riduce la pagina senza perdere elementi o modificare gli URL', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      id: index,
      url: `https://example.com/${index}?text=${'x'.repeat(350)}`,
    }));
    const seen: typeof items = [];
    let offset = 0;
    for (;;) {
      const page = paginateItems(items, offset, (values, nextOffset) => ({
        items: values,
        offset,
        nextOffset,
        total: items.length,
      }));
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.length).toBeLessThan(5);
      seen.push(...page.items);
      if (page.nextOffset === null) break;
      expect(page.nextOffset).toBe(offset + page.items.length);
      offset = page.nextOffset;
    }
    expect(seen).toEqual(items);
  });

  it('ricostruisce esattamente il testo con escape e caratteri Unicode', () => {
    const text = '"\\\n😀è'.repeat(1000);
    let offset = 0;
    let restored = '';
    for (;;) {
      const page = paginateText(text, offset, { slug: 'evento' });
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(1500);
      restored += page.text;
      if (page.nextOffset === null) break;
      expect(page.text).not.toMatch(/[\uD800-\uDBFF]$/u);
      offset = page.nextOffset;
    }
    expect(restored).toBe(text);
  });

  it('rifiuta un singolo elemento troppo grande e offset non validi', () => {
    expect(() =>
      paginateItems(['x'.repeat(2000)], 0, (items) => ({ items })),
    ).toThrow(/pagina|dimensione/iu);
    expect(() => paginateText('testo', -1, {})).toThrow(/offset/iu);
    expect(() => paginateText('testo', 0.5, {})).toThrow(/offset/iu);
  });
});
