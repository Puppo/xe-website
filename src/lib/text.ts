export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('it-IT'))
    .join('');
}

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
}

function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .trim()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-');
}

/** Extract ATX-style headings with deterministic, de-duplicated slug identifiers. */
export function markdownHeadings(markdown: string): MarkdownHeading[] {
  const seen = new Map<string, number>(),
    headings: MarkdownHeading[] = [];

  for (const line of markdown.split('\n')) {
    const markers = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!markers || markers.length < 3) {
      continue;
    }
    const text = markers[2]?.trim() ?? '',
      slug = headingSlug(text),
      previous = seen.get(slug) ?? 0;
    seen.set(slug, previous + 1);
    headings.push({
      id: previous === 0 ? slug : `${slug}-${previous}`,
      level: markers[1]?.length ?? 1,
      text,
    });
  }
  return headings;
}

export function markdownExcerpt(markdown: string, maxLength = 160): string {
  const text = markdown
    .replaceAll(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/^\s{0,3}(?:#{1,6}|[-+*>])\s*/gm, '')
    .replaceAll(/[`*_~]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) {
    return text;
  }
  const candidate = text.slice(0, maxLength + 1),
    boundary = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, boundary > maxLength / 2 ? boundary : maxLength).trimEnd()}…`;
}
