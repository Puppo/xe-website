export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('it-IT'))
    .join('');
}

export function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}
