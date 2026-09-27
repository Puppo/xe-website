import { describe, expect, it } from 'vitest';
import { isSitemapExcluded } from '../src/lib/deployment.mjs';

describe('lib/deployment.isSitemapExcluded', () => {
  it('esclude esattamente le pagine di servizio alla radice', () => {
    expect(isSitemapExcluded('/grazie/', '/')).toBe(true);
    expect(isSitemapExcluded('/404.html', '/')).toBe(true);
  });

  it('esclude esattamente le pagine di servizio con un base path', () => {
    expect(isSitemapExcluded('/preview/grazie/', '/preview/')).toBe(true);
    expect(isSitemapExcluded('/preview/404.html', '/preview/')).toBe(true);
  });

  it('non esclude percorsi che contengono il nome solo come sottostringa', () => {
    expect(isSitemapExcluded('/eventi/404-fest/', '/')).toBe(false);
    expect(isSitemapExcluded('/eventi/grazie-degli-ospiti/', '/')).toBe(false);
    expect(isSitemapExcluded('/grazie-mile/', '/')).toBe(false);
    expect(isSitemapExcluded('/eventi/', '/')).toBe(false);
  });
});
