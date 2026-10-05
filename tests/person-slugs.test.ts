import { describe, expect, it } from 'vitest';
import {
  canonicalPersonSlug,
  legacyPersonSlugs,
  personIdFromFilename,
  personSlugAliases,
} from '../src/lib/person-slugs.mjs';
import { isSitemapExcluded } from '../src/lib/deployment.mjs';

describe('Slug delle persone in kebab case', () => {
  it('normalizza nomi, accenti, PascalCase e identificatori storici', () => {
    expect(canonicalPersonSlug('Èrica De Luca')).toBe('erica-de-luca');
    expect(canonicalPersonSlug('MarioRossi')).toBe('mario-rossi');
    expect(canonicalPersonSlug('mario-rossi')).toBe('mario-rossi');
    for (const [alias, canonical] of Object.entries(legacyPersonSlugs)) {
      expect(canonicalPersonSlug(alias)).toBe(canonical);
      expect(personSlugAliases(canonical)).toContain(alias);
    }
    expect(personSlugAliases('mario-rossi')).toEqual([]);
    expect(canonicalPersonSlug('constructor')).toBe('constructor');
  });

  it('rifiuta i nomi file non canonici senza normalizzarli silenziosamente', () => {
    expect(personIdFromFilename('mario-rossi.md')).toBe('mario-rossi');
    for (const filename of [
      'MarioRossi.md',
      'mario.rossi.md',
      'robertomazzoli.md',
      'mario--rossi.md',
      'nested/mario-rossi.md',
      'mario-rossi.json',
    ]) {
      expect(() => personIdFromFilename(filename)).toThrow(/kebab case/u);
    }
  });

  it('esclude gli alias dalla sitemap anche con un percorso di base', () => {
    for (const base of ['/', '/community/']) {
      for (const [alias, canonical] of Object.entries(legacyPersonSlugs)) {
        expect(isSitemapExcluded(`${base}soci/${alias}/`, base)).toBe(true);
        expect(isSitemapExcluded(`${base}soci/${canonical}/`, base)).toBe(
          false,
        );
      }
    }
  });
});
