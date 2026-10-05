/** Historical profile spellings retained as aliases of canonical kebab-case IDs.
 * @type {Readonly<Record<string, string>>}
 */
export const legacyPersonSlugs = Object.freeze({
  MassimilianoBarbierato: 'massimiliano-barbierato',
  massimilianobarbierato: 'massimiliano-barbierato',
  'mirko.rezzin': 'mirko-rezzin',
  mirkorezzin: 'mirko-rezzin',
  'roberto.ferro': 'roberto-ferro',
  robertoferro: 'roberto-ferro',
  robertomazzoli: 'roberto-mazzoli',
  vincenzofoggia: 'vincenzo-foggia',
});

/** Normalize names and legacy identifiers for generated person filenames.
 * @param {string} value
 */
export function canonicalPersonSlug(value) {
  return (
    (Object.hasOwn(legacyPersonSlugs, value)
      ? legacyPersonSlugs[value]
      : undefined) ??
    value
      .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, '$1-$2')
      .replaceAll(/([a-z\d])([A-Z])/gu, '$1-$2')
      .normalize('NFKD')
      .replaceAll(/[\u0300-\u036F]/gu, '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, '-')
      .replaceAll(/^-|-$/gu, '')
  );
}

/** Validate rather than silently normalize contributor-created filenames.
 * @param {string} filename
 */
export function personIdFromFilename(filename) {
  const id = filename.replace(/\.md$/u, '');
  if (
    !filename.endsWith('.md') ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) ||
    canonicalPersonSlug(id) !== id
  ) {
    throw new Error(
      `Il profilo "${filename}" deve usare un nome file in kebab case, per esempio "${canonicalPersonSlug(id)}.md".`,
    );
  }
  return id;
}

/** @param {string} id */
export function personSlugAliases(id) {
  return Object.entries(legacyPersonSlugs)
    .filter(([, canonical]) => canonical === id)
    .map(([alias]) => alias);
}
