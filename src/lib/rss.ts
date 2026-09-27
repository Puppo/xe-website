export interface RssItem {
  description: string;
  link: string;
  pubDate: Date;
  title: string;
}

export interface RssChannel {
  description: string;
  feedUrl: string;
  items: RssItem[];
  language: string;
  lastBuildDate: Date;
  link: string;
  title: string;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function rssXml(channel: RssChannel): string {
  const items = channel.items
    .map((item) =>
      [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <description>${escapeXml(item.description)}</description>`,
        `      <pubDate>${item.pubDate.toUTCString()}</pubDate>`,
        `      <guid>${escapeXml(item.link)}</guid>`,
        '    </item>',
      ].join('\n'),
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>${escapeXml(channel.language)}</language>
    <lastBuildDate>${channel.lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>
`;
}
