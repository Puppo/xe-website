import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { eventSlug, isCancelled, sortDescending } from '../lib/events';
import { rssXml } from '../lib/rss';
import { withBase } from '../lib/urls';

const FEED_ITEMS_LIMIT = 20;

export const GET: APIRoute = async ({ site }) => {
  const [siteEntry] = await getCollection('site');
  const events = (await getCollection('events', ({ data }) => !data.draft))
    .sort(sortDescending)
    .slice(0, FEED_ITEMS_LIMIT);
  const xml = rssXml({
    description: `I prossimi e più recenti eventi organizzati da ${siteEntry.data.name}.`,
    feedUrl: new URL(withBase('/rss.xml'), site).href,
    items: events.map((event) => ({
      description: event.data.description,
      link: new URL(withBase(`/eventi/${eventSlug(event)}/`), site).href,
      pubDate: event.data.date,
      title: isCancelled(event)
        ? `${event.data.title} (evento annullato)`
        : event.data.title,
    })),
    language: 'it-it',
    lastBuildDate: events[0]?.data.date ?? new Date(),
    link: new URL(withBase('/eventi/'), site).href,
    title: `Eventi — ${siteEntry.data.name}`,
  });

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
