export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('it-IT'))
    .join('');
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
