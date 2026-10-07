import {
  glob,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { enrichMaterials } from '../scripts/enrich-event-materials.mjs';
import {
  cleanMaterialMarkdown,
  extractLegacyMaterials,
  recoverEventMaterials,
} from '../scripts/lib/legacy-materials.mjs';
import { mergeSessions } from '../scripts/lib/legacy-sessions.mjs';
import { markdownParts } from '../scripts/lib/speaker-enrichment.mjs';
import { eventInputSchema } from '../src/content-schemas';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const fixture = (slug: string) =>
  readFile(new URL(`fixtures/materials/${slug}.html`, import.meta.url), 'utf8');

async function archiveBefore() {
  const records: { file: string; data: unknown; body: string }[] = JSON.parse(
    await readFile(
      new URL('fixtures/materials/archive-before.json', import.meta.url),
      'utf8',
    ),
  );
  return records.map((record) => ({
    ...record,
    data: eventInputSchema.parse(record.data),
  }));
}

async function peopleNames() {
  const names = new Map<string, string>();
  for await (const path of glob('src/data/people/*.md')) {
    const data = parse(markdownParts(await readFile(path, 'utf8')).frontmatter);
    names.set(path.split('/').at(-1)?.replace('.md', '') ?? '', data.name);
  }
  return names;
}

async function recover(slug: string) {
  const before = (await archiveBefore()).find(({ data }) =>
    data.sourceUrl.endsWith(`/${slug}/`),
  );
  if (!before) throw new Error('Fixture mancante');
  return recoverEventMaterials({
    data: before.data,
    body: before.body,
    evidence: extractLegacyMaterials(
      await fixture(slug),
      before.data.sourceUrl,
    ),
    peopleNames: await peopleNames(),
  });
}

describe('recupero e collocazione dei materiali', () => {
  it('collega i dodici materiali ai nove talk dell’esempio conservando il programma completo', async () => {
    const result = await recover('one-day-app-modernization');
    expect(result.sessions).toHaveLength(15);
    expect(
      result.sessions.filter(
        (session: { materials?: unknown[] }) => session.materials?.length,
      ),
    ).toHaveLength(9);
    expect(
      result.sessions.flatMap(
        (session: { materials?: unknown[] }) => session.materials ?? [],
      ),
    ).toHaveLength(12);
    expect(result.materials).toEqual([]);
    expect(result.body).not.toContain('Slide e codice sessioni');
    expect(
      result.sessions.find(
        (session: { title: string }) =>
          session.title === 'Modernize your community',
      ).materials,
    ).toEqual([]);
    expect(
      result.sessions
        .find(
          (session: { title: string }) =>
            session.title === 'Blazor United. Un salto nel futuro',
        )
        .materials.map((material: { label: string }) => material.label),
    ).toEqual(['Slide', 'Codice']);
  });

  it('riconosce i titoli espliciti e l’eccezione verificata della keynote', async () => {
    const result = await recover('blazorconf2026');
    expect(
      result.sessions.flatMap(
        (session: { materials?: unknown[] }) => session.materials ?? [],
      ),
    ).toHaveLength(8);
    expect(result.sessions[1].materials).toHaveLength(1);
    expect(result.body).toContain('https://blazorconf.it/');
    expect(result.body).not.toContain('Disponibile il materiale');
    expect(result.materials).toEqual([]);
  });

  it('mantiene le slide comuni e assegna i repository ai singoli speaker', async () => {
    const result = await recover('net-maui');
    expect(result.materials).toHaveLength(1);
    expect(
      result.sessions
        .flatMap(
          (session: { materials?: { url: string }[] }) =>
            session.materials ?? [],
        )
        .map((material: { url: string }) => material.url),
    ).toEqual([
      'https://github.com/bortolin/MauiBeerApp',
      'https://github.com/andreadottor/maui-blazor-hybrid',
    ]);
    expect(result.body).not.toContain('Codice Bortolin');
  });

  it('usa le righe sorgenti conservando abstract e agenda scaricabile', async () => {
    const result = await recover('one-day-enterprise-application');
    expect(
      result.sessions.flatMap(
        (session: { materials?: unknown[] }) => session.materials ?? [],
      ),
    ).toHaveLength(10);
    expect(
      result.sessions.some((session: { description?: string }) =>
        session.description?.includes('Scarica presentazione'),
      ),
    ).toBe(false);
    expect(
      result.sessions.find((session: { title: string }) =>
        session.title.endsWith('Welcome to the (state) machine'),
      ).materials,
    ).toHaveLength(1);
    expect(result.body).toContain('oneday-enterpriseapplication-agenda.pdf');
    expect(result.body).toContain('condivideremo esperienze');
  });

  it('recupera link nelle descrizioni senza trasformare prerequisiti e riferimenti in materiali', async () => {
    const spa = await recover('online-meeting-spa-framework-a-confronto');
    expect(
      spa.sessions.flatMap(
        (session: { materials?: unknown[] }) => session.materials ?? [],
      ),
    ).toHaveLength(4);
    expect(
      spa.sessions.every(
        (session: { description?: string }) => !session.description,
      ),
    ).toBe(true);
    const git = await recover('lab-git-e-github');
    expect(git.materials).toEqual([]);
    expect(git.sessions[0].materials).toEqual([]);
    expect(git.body.match(/## Prerequisiti/gu)).toHaveLength(1);
    expect(git.body).toContain('Avere un account su GitHub');
    expect(git.body).toContain('https://code.visualstudio.com/#alt-downloads');
    const asyncNight = await recover('async-night');
    expect(asyncNight.materials).toHaveLength(1);
    expect(asyncNight.body).toContain('Introduzione a Dapper');
    expect(asyncNight.body).toContain(
      'https://github.com/StackExchange/Dapper',
    );
  });

  it('lascia comuni i nomi che non identificano un singolo talk', async () => {
    const result = await recover('javascript-da-0-a-es6');
    expect(result.materials).toHaveLength(2);
    expect(result.materials[0].label).toContain('Andrea Dottor');
    expect(result.warnings.join(' ')).toContain('ambigua');
    const evidence = extractLegacyMaterials(
      '<article class="maincontent"><p>Slide Ada Lovelace: <a href="https://example.com/slide">Slide Ada Lovelace</a></p></article>',
      'https://example.com/evento/',
    );
    const collision = recoverEventMaterials({
      data: {
        sourceUrl: 'https://example.com/evento/',
        sessions: [
          { title: 'Uno', speakers: [{ person: 'ada' }] },
          { title: 'Due', speakers: [{ person: 'altra' }] },
        ],
        materials: [],
      },
      body: '',
      evidence,
      peopleNames: new Map([
        ['ada', 'Ada Lovelace'],
        ['altra', 'ADA LOVELACE'],
      ]),
    });
    expect(collision.materials).toHaveLength(1);
    expect(collision.warnings.join(' ')).toContain('ambigua');
    const differentSpeaker = recoverEventMaterials({
      data: {
        sourceUrl: 'https://example.com/evento/',
        sessions: [{ title: 'Talk di Grace', speakers: ['Grace Hopper'] }],
        materials: [],
      },
      body: '',
      evidence,
    });
    expect(differentSpeaker.materials).toHaveLength(1);
    expect(differentSpeaker.sessions[0].materials).toBeUndefined();
  });

  it('ignora link incidentali e valida gli URL dei materiali nelle sessioni', () => {
    const html =
        '<article class="maincontent"><p>Riunione dei soci.</p><p>Il nostro progetto usa <a href="https://github.com/example/project">questo progetto</a>.</p></article>',
      result = recoverEventMaterials({
        data: {
          sourceUrl: 'https://example.com/evento/',
          materials: [],
          sessions: [],
        },
        body: 'Riunione dei soci.',
        evidence: extractLegacyMaterials(html, 'https://example.com/evento/'),
      });
    expect(result.materials).toEqual([]);
    expect(result.sessions).toEqual([]);
    expect(result.body).toBe('Riunione dei soci.');
    expect(
      eventInputSchema.safeParse({
        title: 'Evento',
        description: 'Descrizione',
        date: '2026-10-07',
        sourceUrl: 'https://example.com',
        sessions: [
          { title: 'Talk', materials: [{ label: 'Slide', url: 'non-un-url' }] },
        ],
      }).success,
    ).toBe(false);
  });

  it('rimuove solo blocchi dedicati alle risorse conservando prosa e voci non collegate', () => {
    const url = 'https://example.com/slide?key=1#due',
      prose = `Testo che discute queste [slide](${url}) nel suo contesto.\n\n`,
      source = `${prose}- **Il materiale è disponibile:** [Slide](${url})\n- Una nota editoriale da conservare.\n`;
    expect(cleanMaterialMarkdown(source, new Set([url]))).toBe(
      `${prose}- Una nota editoriale da conservare.\n`,
    );
    expect(
      cleanMaterialMarkdown(`**Materiali:**\n\n[Slide](${url})\n`, new Set()),
    ).toContain('Materiali');
    const existing = [
        {
          title: 'Talk',
          time: '10:00',
          speakers: ['Ada'],
          materials: [{ label: 'Slide curate', url }],
        },
      ],
      incoming = [
        {
          title: 'Talk',
          time: '10:00',
          speakers: ['Ada'],
          materials: [
            { label: 'Slide', url },
            { label: 'Demo', url: 'https://example.com/demo' },
          ],
        },
      ];
    expect(mergeSessions(existing, incoming)[0].materials).toEqual([
      ...existing[0].materials,
      incoming[0].materials[1],
    ]);
    expect(existing[0].materials).toHaveLength(1);
  });

  it('simula senza scritture, conserva commenti e metadati e rende idempotenti le riparazioni', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xe-materials-'));
    roots.push(root);
    await mkdir(join(root, 'src/data/events'), { recursive: true });
    await mkdir(join(root, 'src/data/people'), { recursive: true });
    const path = join(root, 'src/data/events/test.md'),
      source =
        '---\n# Nota editoriale\ntitle: Evento\nsourceUrl: https://example.com/evento/\ndraft: true\nmaterials: [{label: Slide, url: https://example.com/slide}]\nsessions: [{title: Talk, time: "10:00", speakers: [Ada]}]\n---\n\nProsa **originale**.\n\n**Il materiale è disponibile:** [Slide](https://example.com/slide)\n',
      html =
        '<article class="maincontent"><p>Il materiale è disponibile: <a href="https://example.com/slide">Slide</a></p></article>',
      options = { root, fetchPage: async () => html };
    await writeFile(path, source);
    expect((await enrichMaterials(options)).updatedEvents).toBe(1);
    expect(await readFile(path, 'utf8')).toBe(source);
    expect(await readdir(root)).toEqual(['src']);
    expect(
      (await enrichMaterials({ ...options, write: true })).updatedEvents,
    ).toBe(1);
    const updated = await readFile(path, 'utf8');
    expect(updated).toContain('# Nota editoriale');
    expect(updated).toContain('draft: true');
    expect(updated).toContain('Prosa **originale**.');
    expect(
      (await enrichMaterials({ ...options, write: true })).updatedEvents,
    ).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(updated);
    const unavailable = await enrichMaterials({
      root,
      write: true,
      fetchPage: async () => {
        throw new Error('503');
      },
    });
    expect(unavailable.updatedEvents).toBe(0);
    expect(unavailable.report).toContain('fonte non disponibile');
    expect(await readFile(path, 'utf8')).toBe(updated);
  });

  it('conserva gli URL, i metadati e le associazioni di tutti i 45 eventi riparati', async () => {
    const records = await archiveBefore();
    expect(records).toHaveLength(45);
    for (const record of records) {
      const content = markdownParts(await readFile(record.file, 'utf8')),
        data = eventInputSchema.parse(parse(content.frontmatter)),
        originalUrls = record.data.materials.map(({ url }) => url),
        resourceUrls = new Set(
          [
            ...data.materials,
            ...data.sessions.flatMap((session) => session.materials),
          ].map(({ url }) => url),
        ),
        {
          sessions: beforeSessions,
          materials: _beforeMaterials,
          ...beforeMetadata
        } = record.data,
        { sessions, materials: _materials, ...metadata } = data;
      expect(metadata, record.file).toEqual(beforeMetadata);
      expect(
        sessions.map(
          ({
            description: _description,
            materials: _sessionMaterials,
            ...session
          }) => session,
        ),
        record.file,
      ).toEqual(
        beforeSessions.map(
          ({
            description: _description,
            materials: _sessionMaterials,
            ...session
          }) => session,
        ),
      );
      for (const url of originalUrls)
        expect(
          resourceUrls.has(url) || content.remainder.includes(url),
          `${record.file}: ${url}`,
        ).toBe(true);
      for (const match of record.body.matchAll(
        /\]\((https?:\/\/[^\s)]+|\/[^\s)]+)/gu,
      )) {
        expect(
          resourceUrls.has(match[1]) || content.remainder.includes(match[1]),
          `${record.file}: ${match[1]}`,
        ).toBe(true);
      }
      for (const url of resourceUrls)
        expect(content.remainder, record.file).not.toContain(url);
    }
  });
});
