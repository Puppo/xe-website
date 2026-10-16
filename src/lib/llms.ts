import type { CollectionEntry } from 'astro:content';
import { prefixPath } from './deployment.mjs';
import {
  eventSlug,
  eventYear,
  formatCalendarDate,
  formatEventDate,
  isCancelled,
  isPastEvent,
  registrationMessage,
  registrationState,
  sortAscending,
  sortDescending,
} from './events';
import type { EventEntry } from './events';
import {
  currentMembers,
  isCurrentMember,
  recentEventsForPerson,
} from './people';
import type { BaseUrl, PeopleContext, PersonEntry } from './people';
import { markdownExcerpt } from './text';
import { withBase } from './urls';

export type SiteEntry = CollectionEntry<'site'>;
export type PageEntry = CollectionEntry<'pages'>;
export type LocationEntry = CollectionEntry<'locations'>;

const MAX_RECENT_MEMBER_EVENTS = 50;

/** Resolve the site-relative `llms.txt` path for a given page pathname. */
export function llmsTxtPath(
  pathname: string,
  noindex = false,
  base = import.meta.env.BASE_URL,
): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`,
    rootLlms = prefixPath('/llms.txt', normalizedBase);
  if (noindex) {
    return rootLlms;
  }
  const basePrefix = normalizedBase.slice(0, -1),
    relative = pathname.startsWith(normalizedBase)
      ? `/${pathname.slice(normalizedBase.length)}`
      : basePrefix && pathname.startsWith(basePrefix)
        ? `/${pathname.slice(basePrefix.length).replace(/^\/+/u, '')}`
        : pathname;
  if (
    !relative ||
    relative === '/' ||
    relative === '/404' ||
    relative === '/404/' ||
    relative === '/404.html' ||
    relative === '/grazie' ||
    relative === '/grazie/'
  ) {
    return rootLlms;
  }
  const directory = relative.endsWith('/') ? relative : `${relative}/`;
  return prefixPath(`${directory}llms.txt`, normalizedBase);
}

/** Build a UTF-8 plain-text HTTP response for an `llms.txt` endpoint. */
export function llmsResponse(content: string): Response {
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function absoluteUrl(path: string, site: BaseUrl): string {
  return new URL(withBase(path), site).href;
}

/** Rewrite site-relative Markdown links to full URLs that include the deployment base. */
export function resolveMarkdownUrls(markdown: string, site: BaseUrl): string {
  return markdown.replaceAll(
    /(\]\()(\/(?!\/)[^)\s]*)((?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\))/gu,
    (_match, prefix: string, path: string, suffix: string) =>
      `${prefix}${absoluteUrl(path, site)}${suffix}`,
  );
}

function eventStatusLabel(event: EventEntry): string {
  return isCancelled(event) ? 'evento annullato' : 'evento programmato';
}

function formatEventLine(event: EventEntry, site: BaseUrl): string {
  const slug = eventSlug(event),
    llmsUrl = absoluteUrl(`/eventi/${slug}/llms.txt`, site),
    htmlUrl = absoluteUrl(`/eventi/${slug}/`, site),
    dateLabel = formatEventDate(event.data.date),
    status = eventStatusLabel(event),
    venue = event.data.venue ? ` · ${event.data.venue.name}` : '';
  return `- [${event.data.title}](${llmsUrl}) ([pagina HTML](${htmlUrl})): ${dateLabel} (${status}${venue}) — ${event.data.description}`;
}

export function renderRootLlmsTxt(options: {
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
  events: EventEntry[];
  people: PersonEntry[];
  context: PeopleContext;
  now?: Date;
}): string {
  const { site, siteUrl, events, people, context, now = new Date() } = options,
    publishedEvents = events.filter((event) => !event.data.draft),
    upcoming = publishedEvents
      .filter((event) => !isPastEvent(event, now))
      .sort(sortAscending),
    past = publishedEvents
      .filter((event) => isPastEvent(event, now))
      .sort(sortDescending),
    years = [...new Set(publishedEvents.map(eventYear))].sort((a, b) => b - a),
    members = currentMembers(people, context),
    lines = [
      `# ${site.name}`,
      '',
      `> ${site.description} ${site.tagline}.`,
      '',
      `${site.name} è una community tecnologica con sede a ${site.address} (CF ${site.fiscalCode}). Contatto email: ${site.email}.`,
      '',
      '## Albero del sito (llms.txt)',
      '',
      `- [Home](${absoluteUrl('/llms.txt', siteUrl)}) ([pagina HTML](${absoluteUrl('/', siteUrl)})): Panoramica della community e indice principale.`,
      `  - [Chi siamo](${absoluteUrl('/chi-siamo/llms.txt', siteUrl)}) ([pagina HTML](${absoluteUrl('/chi-siamo/', siteUrl)})): Storia, valori, attività e provenienza geografica dei soci.`,
      `  - [Eventi](${absoluteUrl('/eventi/llms.txt', siteUrl)}) ([pagina HTML](${absoluteUrl('/eventi/', siteUrl)})): Prossimi appuntamenti e archivio storico per anno (${publishedEvents.length} eventi).`,
      `  - [Soci](${absoluteUrl('/soci/llms.txt', siteUrl)}) ([pagina HTML](${absoluteUrl('/soci/', siteUrl)})): Albo soci dell’anno associativo ${context.year} (${members.length} soci).`,
      `  - [Contatti](${absoluteUrl('/contatti/llms.txt', siteUrl)}) ([pagina HTML](${absoluteUrl('/contatti/', siteUrl)})): Recapiti per scrivere allo staff e proporre sessioni o collaborazioni.`,
      `  - [Informativa sulla privacy](${absoluteUrl('/privacy-policy/llms.txt', siteUrl)}) ([pagina HTML](${absoluteUrl('/privacy-policy/', siteUrl)})): Informazioni sul trattamento dei dati personali.`,
      '',
      '## Prossimi appuntamenti',
      '',
      ...(upcoming.length > 0
        ? upcoming.map((event) => formatEventLine(event, siteUrl))
        : ['Non ci sono ancora nuovi appuntamenti in calendario.']),
      '',
      '## Archivio eventi per anno',
      '',
      ...years.map((year) => {
        const count = publishedEvents.filter(
          (event) => eventYear(event) === year,
        ).length;
        return `- [Eventi del ${year}](${absoluteUrl(`/eventi/${year}/llms.txt`, siteUrl)}) ([pagina HTML](${absoluteUrl(`/eventi/${year}/`, siteUrl)})): ${count} ${count === 1 ? 'appuntamento' : 'appuntamenti'}.`;
      }),
      '',
      '## Risorse machine-readable',
      '',
      `- [Feed RSS degli eventi](${absoluteUrl('/rss.xml', siteUrl)}): Ultimi eventi pubblicati in formato RSS 2.0.`,
      `- [Catalogo JSON degli eventi](${absoluteUrl('/webmcp/events.json', siteUrl)}): Dati strutturati di tutti gli eventi pubblicati.`,
      `- [Catalogo JSON dei soci](${absoluteUrl('/webmcp/members.json', siteUrl)}): Dati strutturati dell’albo soci dell’anno associativo ${context.year}.`,
    ];

  if (past.length > 0 && upcoming.length === 0) {
    lines.push(
      '',
      '## Ultimi eventi in archivio',
      '',
      ...past.slice(0, 5).map((event) => formatEventLine(event, siteUrl)),
    );
  }

  return `${lines.join('\n')}\n`;
}

export function renderAboutLlmsTxt(options: {
  page: PageEntry;
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
  locations: LocationEntry[];
}): string {
  const { page, site, siteUrl, locations } = options,
    body = resolveMarkdownUrls((page.body ?? '').trim(), siteUrl),
    lines = [
      `# ${page.data.title} — ${site.name}`,
      '',
      `> ${page.data.description}`,
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- File corrente: [Chi siamo (llms.txt)](${absoluteUrl('/chi-siamo/llms.txt', siteUrl)})`,
      `- Pagina HTML: [Chi siamo](${absoluteUrl('/chi-siamo/', siteUrl)})`,
      '',
      '## Contenuto',
      '',
      body,
      '',
      '## Provenienza di alcuni soci',
      '',
      ...locations.map(
        ({ data }) =>
          `- ${data.province}: ${data.count} ${data.count === 1 ? 'socio' : 'soci'}`,
      ),
    ];
  return `${lines.join('\n')}\n`;
}

export function renderContactLlmsTxt(options: {
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
}): string {
  const { site, siteUrl } = options,
    lines = [
      `# Contatti — ${site.name}`,
      '',
      '> Contatta lo staff di XeDotNet per proposte, collaborazioni e informazioni.',
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- File corrente: [Contatti (llms.txt)](${absoluteUrl('/contatti/llms.txt', siteUrl)})`,
      `- Pagina HTML: [Contatti](${absoluteUrl('/contatti/', siteUrl)})`,
      '',
      '## Come contattarci',
      '',
      'Per proporre una sessione, una collaborazione o un sostegno alle attività, scrivi allo staff includendo tutte le informazioni utili.',
      '',
      `- Email: [${site.email}](mailto:${site.email})`,
      `- Pagina contatti: [Contatti](${absoluteUrl('/contatti/', siteUrl)})`,
      `- Sede legale: ${site.address}`,
      `- Codice fiscale: ${site.fiscalCode}`,
      '',
      '## Canali social',
      '',
      ...site.socials.map((social) => `- [${social.label}](${social.url})`),
    ];
  return `${lines.join('\n')}\n`;
}

export function renderPrivacyLlmsTxt(options: {
  page: PageEntry;
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
}): string {
  const { page, site, siteUrl } = options,
    body = resolveMarkdownUrls((page.body ?? '').trim(), siteUrl),
    lines = [
      `# ${page.data.title} — ${site.name}`,
      '',
      `> ${page.data.description}`,
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- File corrente: [${page.data.title} (llms.txt)](${absoluteUrl('/privacy-policy/llms.txt', siteUrl)})`,
      `- Pagina HTML: [${page.data.title}](${absoluteUrl('/privacy-policy/', siteUrl)})`,
      '',
      body,
    ];
  return `${lines.join('\n')}\n`;
}

export function renderEventsIndexLlmsTxt(options: {
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
  events: EventEntry[];
  now?: Date;
}): string {
  const { site, siteUrl, events, now = new Date() } = options,
    published = events.filter((event) => !event.data.draft),
    upcoming = published
      .filter((event) => !isPastEvent(event, now))
      .sort(sortAscending),
    past = published
      .filter((event) => isPastEvent(event, now))
      .sort(sortDescending),
    years = [...new Set(published.map(eventYear))].sort((a, b) => b - a),
    lines = [
      `# Eventi — ${site.name}`,
      '',
      '> Prossimi appuntamenti e archivio degli eventi organizzati da XeDotNet.',
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- File corrente: [Eventi (llms.txt)](${absoluteUrl('/eventi/llms.txt', siteUrl)})`,
      `- Pagina HTML: [Eventi](${absoluteUrl('/eventi/', siteUrl)})`,
      '',
      '## Prossimi appuntamenti',
      '',
      ...(upcoming.length > 0
        ? upcoming.map((event) => formatEventLine(event, siteUrl))
        : ['Non ci sono ancora nuovi appuntamenti in calendario.']),
      '',
      `## Albero archivio per anno (${past.length} eventi passati)`,
      '',
      ...years.flatMap((year) => {
        const yearEvents = published
          .filter((event) => eventYear(event) === year)
          .sort(sortDescending);
        return [
          `- [Eventi del ${year}](${absoluteUrl(`/eventi/${year}/llms.txt`, siteUrl)}) ([pagina HTML](${absoluteUrl(`/eventi/${year}/`, siteUrl)})): ${yearEvents.length} ${yearEvents.length === 1 ? 'appuntamento' : 'appuntamenti'}`,
          ...yearEvents.map((event) => {
            const slug = eventSlug(event);
            return `  - [${event.data.title}](${absoluteUrl(`/eventi/${slug}/llms.txt`, siteUrl)}): ${formatEventDate(event.data.date)} (${eventStatusLabel(event)})`;
          }),
        ];
      }),
    ];
  return `${lines.join('\n')}\n`;
}

export function renderEventsYearLlmsTxt(options: {
  year: number;
  events: EventEntry[];
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
}): string {
  const { year, events, site, siteUrl } = options,
    sorted = [...events]
      .filter((event) => !event.data.draft)
      .sort(sortDescending),
    lines = [
      `# Eventi del ${year} — ${site.name}`,
      '',
      `> Archivio degli eventi XeDotNet organizzati nel ${year} (${sorted.length} ${sorted.length === 1 ? 'appuntamento' : 'appuntamenti'}).`,
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- Sezione superiore: [Eventi (llms.txt)](${absoluteUrl('/eventi/llms.txt', siteUrl)})`,
      `- File corrente: [Eventi del ${year} (llms.txt)](${absoluteUrl(`/eventi/${year}/llms.txt`, siteUrl)})`,
      `- Pagina HTML: [Eventi del ${year}](${absoluteUrl(`/eventi/${year}/`, siteUrl)})`,
      '',
      `## Appuntamenti del ${year}`,
      '',
      ...sorted.map((event) => formatEventLine(event, siteUrl)),
    ];
  return `${lines.join('\n')}\n`;
}

export function renderEventDetailLlmsTxt(options: {
  event: EventEntry;
  peopleById: ReadonlyMap<string, PersonEntry>;
  context: PeopleContext;
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
  now?: Date;
}): string {
  const {
      event,
      peopleById,
      context,
      site,
      siteUrl,
      now = new Date(),
    } = options,
    slug = eventSlug(event),
    year = eventYear(event),
    regState = registrationState(event, now),
    regMessage = registrationMessage(event, now),
    regUrl = regState === 'open' ? event.data.registration.url : undefined,
    body = resolveMarkdownUrls((event.body ?? '').trim(), siteUrl),
    lines = [
      `# ${event.data.title}`,
      '',
      `> ${event.data.description}`,
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home — ${site.name} (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- Sezione: [Eventi (llms.txt)](${absoluteUrl('/eventi/llms.txt', siteUrl)})`,
      `- Anno: [Eventi del ${year} (llms.txt)](${absoluteUrl(`/eventi/${year}/llms.txt`, siteUrl)})`,
      `- File corrente: [${event.data.title} (llms.txt)](${absoluteUrl(`/eventi/${slug}/llms.txt`, siteUrl)})`,
      `- Pagina HTML: [${event.data.title}](${absoluteUrl(`/eventi/${slug}/`, siteUrl)})`,
      '',
      '## Dettagli',
      '',
      `- Stato: ${isCancelled(event) ? 'Evento annullato' : 'Evento programmato'}`,
      `- Data: ${formatEventDate(event.data.date)}${event.data.endDate ? ` – ${formatEventDate(event.data.endDate)}` : ''}`,
      ...(event.data.eventType ? [`- Tipo: ${event.data.eventType}`] : []),
      ...(event.data.venue
        ? [
            `- Luogo: ${event.data.venue.url ? `[${event.data.venue.name}](${event.data.venue.url})` : event.data.venue.name}`,
          ]
        : []),
      `- Periodo di iscrizione: ${regMessage}${regUrl ? ` ([Iscriviti](${regUrl}))` : ''}`,
    ];

  if (body) {
    lines.push('', '## Descrizione', '', body);
  }

  if (event.data.sessions.length > 0) {
    lines.push('', '## Programma', '');
    for (const session of event.data.sessions) {
      const speakerLabels = session.speakers.map((speaker) => {
          if (typeof speaker === 'string') {
            return speaker;
          }
          const person = peopleById.get(speaker.person.id);
          if (!person) {
            return speaker.person.id;
          }
          if (isCurrentMember(person, context)) {
            return `[${person.data.name}](${absoluteUrl(`/soci/${person.id}/llms.txt`, siteUrl)})`;
          }
          return person.data.profileUrl
            ? `[${person.data.name}](${person.data.profileUrl})`
            : person.data.name;
        }),
        timePrefix = session.time ? `${session.time} — ` : '',
        speakerSuffix =
          speakerLabels.length > 0 ? ` (${speakerLabels.join(', ')})` : '';
      lines.push(`- ${timePrefix}${session.title}${speakerSuffix}`);
      if (session.description) {
        lines.push(`  ${session.description}`);
      }
      for (const material of session.materials ?? []) {
        lines.push(
          `  - Materiale: [${material.label}](${absoluteUrl(material.url, siteUrl)})`,
        );
      }
    }
  }

  if (event.data.materials.length > 0) {
    lines.push(
      '',
      '## Materiali',
      '',
      ...event.data.materials.map(
        (material) =>
          `- [${material.label}](${absoluteUrl(material.url, siteUrl)})`,
      ),
    );
  }

  return `${lines.join('\n')}\n`;
}

export function renderMembersIndexLlmsTxt(options: {
  people: PersonEntry[];
  context: PeopleContext;
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
}): string {
  const { people, context, site, siteUrl } = options,
    members = currentMembers(people, context).sort((a, b) =>
      a.data.sortName.localeCompare(b.data.sortName, 'it'),
    ),
    lines = [
      `# Soci — ${site.name}`,
      '',
      `> Le persone che sostengono XeDotNet e rendono possibili le attività della community (Albo soci anno associativo ${context.year}).`,
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- File corrente: [Soci (llms.txt)](${absoluteUrl('/soci/llms.txt', siteUrl)})`,
      `- Pagina HTML: [Soci](${absoluteUrl('/soci/', siteUrl)})`,
      '',
      `## Albo soci (${context.year}) — ${members.length} ${members.length === 1 ? 'socio' : 'soci'}`,
      '',
      ...members.map((member) => {
        const role = context.speakerIds.has(member.id)
            ? 'Socio e speaker'
            : 'Socio',
          title = member.data.title ? ` · ${member.data.title}` : '',
          excerpt = markdownExcerpt(member.body ?? ''),
          summary = excerpt ? ` — ${excerpt}` : '';
        return `- [${member.data.name}](${absoluteUrl(`/soci/${member.id}/llms.txt`, siteUrl)}) ([pagina HTML](${absoluteUrl(`/soci/${member.id}/`, siteUrl)})): ${role}${title}${summary}`;
      }),
    ];
  return `${lines.join('\n')}\n`;
}

export function renderMemberDetailLlmsTxt(options: {
  member: PersonEntry;
  events: EventEntry[];
  context: PeopleContext;
  site: SiteEntry['data'];
  siteUrl: BaseUrl;
}): string {
  const { member, events, context, site, siteUrl } = options,
    isSpeaker = context.speakerIds.has(member.id),
    roleLabel = isSpeaker ? 'Socio e speaker' : 'Socio di XeDotNet',
    description =
      markdownExcerpt(member.body ?? '') ||
      `${member.data.name}, socio di XeDotNet.`,
    biography = resolveMarkdownUrls((member.body ?? '').trim(), siteUrl),
    links = [
      ...(member.data.profileUrl
        ? [{ label: 'Profilo personale', url: member.data.profileUrl }]
        : []),
      ...member.data.links,
    ].filter(
      (link, index, all) =>
        all.findIndex((item) => item.url === link.url) === index,
    ),
    memberEvents = recentEventsForPerson(
      member,
      events,
      MAX_RECENT_MEMBER_EVENTS,
    ),
    lines = [
      `# ${member.data.name}`,
      '',
      `> ${description}`,
      '',
      '## Posizione nell’albero',
      '',
      `- Radice: [Home — ${site.name} (llms.txt)](${absoluteUrl('/llms.txt', siteUrl)})`,
      `- Sezione superiore: [Soci (llms.txt)](${absoluteUrl('/soci/llms.txt', siteUrl)})`,
      `- File corrente: [${member.data.name} (llms.txt)](${absoluteUrl(`/soci/${member.id}/llms.txt`, siteUrl)})`,
      `- Pagina HTML: [${member.data.name}](${absoluteUrl(`/soci/${member.id}/`, siteUrl)})`,
      '',
      '## Profilo',
      '',
      `- Ruolo: ${roleLabel}`,
      `- Anno associativo: ${context.year}`,
      ...(member.data.title ? [`- Qualifica: ${member.data.title}`] : []),
    ];

  if (biography) {
    lines.push('', '## Biografia', '', biography);
  }

  if (links.length > 0) {
    lines.push(
      '',
      '## Collegamenti',
      '',
      ...links.map((link) => `- [${link.label}](${link.url})`),
    );
  }

  if (memberEvents.length > 0) {
    lines.push(
      '',
      `## Eventi con ${member.data.name}`,
      '',
      ...memberEvents.map((event) => {
        const slug = eventSlug(event);
        return `- [${event.data.title}](${absoluteUrl(`/eventi/${slug}/llms.txt`, siteUrl)}) ([pagina HTML](${absoluteUrl(`/eventi/${slug}/`, siteUrl)})): ${formatCalendarDate(event.data.date)} (${eventStatusLabel(event)})`;
      }),
    );
  }

  return `${lines.join('\n')}\n`;
}
