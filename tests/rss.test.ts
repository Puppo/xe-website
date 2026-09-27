import { describe, expect, it } from 'vitest';
import { escapeXml, rssXml } from '../src/lib/rss';
import type { RssChannel } from '../src/lib/rss';

describe('lib/rss.escapeXml', () => {
  it('trasforma le entità XML riservate', () => {
    expect(escapeXml('a & b <c> "d" \'e\'')).toBe(
      'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;',
    );
  });

  it('lascia intatti i testi senza caratteri riservati', () => {
    expect(escapeXml('Eventi XE 2026')).toBe('Eventi XE 2026');
  });
});

describe('lib/rss.rssXml', () => {
  const channel = (): RssChannel => ({
    description: 'I prossimi e più recenti eventi della community.',
    feedUrl: 'https://www.xedotnet.org/rss.xml',
    items: [
      {
        description: 'Descrizione con <markup> & dettagli',
        link: 'https://www.xedotnet.org/eventi/net-conf-2026-xe/',
        pubDate: new Date('2026-10-14T18:30:00Z'),
        title: 'NET Conf 2026 XE',
      },
      {
        description: 'Evento annullato.',
        link: 'https://www.xedotnet.org/eventi/debug-night/',
        pubDate: new Date('2026-04-16T18:30:00Z'),
        title: 'Debug Night (evento annullato)',
      },
    ],
    language: 'it-it',
    lastBuildDate: new Date('2026-10-14T18:30:00Z'),
    link: 'https://www.xedotnet.org/eventi/',
    title: 'Eventi — XE - Development user group',
  });

  it('produce un canale RSS 2.0 con dichiarazione XML e atom:link self', () => {
    const xml = rssXml(channel());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    );
    expect(xml).toContain('<channel>');
    expect(xml).toContain(
      '<title>Eventi — XE - Development user group</title>',
    );
    expect(xml).toContain('<link>https://www.xedotnet.org/eventi/</link>');
    expect(xml).toContain(
      '<atom:link href="https://www.xedotnet.org/rss.xml" rel="self" type="application/rss+xml"/>',
    );
    expect(xml).toContain('<language>it-it</language>');
    expect(xml).toContain(
      '<lastBuildDate>Wed, 14 Oct 2026 18:30:00 GMT</lastBuildDate>',
    );
  });

  it('emette un item per evento con title, link, description, pubDate e guid', () => {
    const xml = rssXml(channel());
    expect(xml).toContain('<title>NET Conf 2026 XE</title>');
    expect(xml).toContain(
      '<link>https://www.xedotnet.org/eventi/net-conf-2026-xe/</link>',
    );
    expect(xml).toContain(
      '<description>Descrizione con &lt;markup&gt; &amp; dettagli</description>',
    );
    expect(xml).toContain('<pubDate>Wed, 14 Oct 2026 18:30:00 GMT</pubDate>');
    expect(xml).toContain(
      '<guid>https://www.xedotnet.org/eventi/net-conf-2026-xe/</guid>',
    );
  });

  it('gestisce un canale senza item', () => {
    const empty = { ...channel(), items: [] };
    const xml = rssXml(empty);
    expect(xml).toContain(
      '<title>Eventi — XE - Development user group</title>',
    );
    expect(xml).not.toContain('<item>');
  });
});
