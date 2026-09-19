import { existsSync, globSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import { deploymentConfig } from '../src/lib/deployment.mjs';

const publicUrl = process.env.SITE_URL || 'https://www.xedotnet.org/',
  { site, base } = deploymentConfig(publicUrl),
  errors = [];

function outputPath(pathname) {
  const relativePath = decodeURIComponent(pathname.slice(base.length));
  if (!relativePath || relativePath.endsWith('/')) {
    return join('dist', relativePath, 'index.html');
  }
  if (!extname(relativePath)) {
    return join('dist', relativePath, 'index.html');
  }
  return join('dist', relativePath);
}

function inspectUrl(value, file, attribute) {
  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('data:')
  ) {
    return;
  }

  let url;
  try {
    url = new URL(value, `${site}${base}`);
  } catch {
    errors.push(`${file}: ${attribute} non valido: ${value}`);
    return;
  }
  if (url.origin !== site) {
    return;
  }
  if (!url.pathname.startsWith(base)) {
    errors.push(
      `${file}: ${attribute} esce dal percorso base ${base}: ${value}`,
    );
    return;
  }
  const target = outputPath(url.pathname);
  if (!existsSync(target)) {
    errors.push(
      `${file}: destinazione mancante per ${attribute}=${value} (${target})`,
    );
  }
}

const htmlFiles = globSync('dist/**/*.html');
for (const file of htmlFiles) {
  const $ = cheerio.load(readFileSync(file, 'utf8'));
  $('[href], [src], [poster]').each((_index, element) => {
    for (const attribute of ['href', 'src', 'poster']) {
      inspectUrl($(element).attr(attribute), file, attribute);
    }
  });
}

const robots = readFileSync('dist/robots.txt', 'utf8'),
  expectedSitemap = `${site}${base}sitemap-index.xml`;
if (!robots.includes(expectedSitemap)) {
  errors.push(`robots.txt non contiene ${expectedSitemap}`);
}

for (const file of globSync('dist/sitemap*.xml')) {
  const sitemap = readFileSync(file, 'utf8'),
    locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
  for (const location of locations) {
    const url = new URL(location);
    if (url.origin !== site || !url.pathname.startsWith(base)) {
      errors.push(`${file}: URL fuori da ${site}${base}: ${location}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.slice(0, 30).join('\n'));
  if (errors.length > 30) {
    console.error(`...e altri ${errors.length - 30} errori.`);
  }
  process.exit(1);
}

console.log(`Verificati ${htmlFiles.length} documenti per ${site}${base}`);
