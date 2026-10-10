import { existsSync, globSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import { deploymentConfig, isSitemapExcluded } from '../src/lib/deployment.mjs';

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
    errors.push(`${file}: invalid ${attribute}: ${value}`);
    return;
  }
  if (url.origin !== site) {
    return;
  }
  if (!url.pathname.startsWith(base)) {
    errors.push(`${file}: ${attribute} leaves the base path ${base}: ${value}`);
    return;
  }
  const target = outputPath(url.pathname);
  if (!existsSync(target)) {
    errors.push(
      `${file}: missing destination for ${attribute}=${value} (${target})`,
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
  errors.push(`robots.txt does not contain ${expectedSitemap}`);
}

for (const file of globSync('dist/sitemap*.xml')) {
  const sitemap = readFileSync(file, 'utf8'),
    locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
  for (const location of locations) {
    const url = new URL(location);
    if (url.origin !== site || !url.pathname.startsWith(base)) {
      errors.push(`${file}: URL outside ${site}${base}: ${location}`);
    }
    if (isSitemapExcluded(url.pathname, base)) {
      errors.push(`${file}: excluded URL present in sitemap: ${location}`);
    }
  }
}

const graziePath = join('dist', 'grazie', 'index.html');
if (existsSync(graziePath)) {
  const grazie = readFileSync(graziePath, 'utf8');
  if (!grazie.includes('content="noindex, nofollow"')) {
    errors.push('dist/grazie/index.html does not contain the noindex metadata');
  }
}

if (errors.length > 0) {
  console.error(errors.slice(0, 30).join('\n'));
  if (errors.length > 30) {
    console.error(`...and ${errors.length - 30} more errors.`);
  }
  process.exit(1);
}

console.log(`Verified ${htmlFiles.length} documents for ${site}${base}`);
