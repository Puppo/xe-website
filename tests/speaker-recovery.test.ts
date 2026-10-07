import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { enrichSpeakers } from '../scripts/enrich-event-speakers.mjs';
import {
  createPeopleNameIndex,
  markdownParts,
  matchSpeaker,
  replaceSpeakerScalars,
} from '../scripts/lib/speaker-enrichment.mjs';
import { createSpeakerIds, recentEventsForPerson } from '../src/lib/people';
import type { PersonEntry, TalkEvent } from '../src/lib/people';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'xe-speakers-'));
  roots.push(root);
  await mkdir(join(root, 'src/data/events'), { recursive: true });
  await mkdir(join(root, 'src/data/people'), { recursive: true });
  const eventPath = join(root, 'src/data/events/test.md');
  await writeFile(
    eventPath,
    '---\n# Commento editoriale\ntitle: Evento\nsourceUrl: https://example.com/evento/\nsessions: []\nmaterials: []\ndraft: false\n---\n\nCorpo con **Ada**.\n',
  );
  await writeFile(
    join(root, 'src/data/people/ada.md'),
    '---\nname: Ada Lovelace\nsortName: Ada Lovelace\npublished: true\nlinks: []\n---\n\nBio.\n',
  );
  return { root, eventPath };
}

const html =
  '<article class="maincontent"><p>Ospiti della serata:</p><ul><li><strong>Ada Lovelace</strong></li><li><strong>Grace Hopper</strong></li><li><strong>XE</strong></li></ul></article>';

describe('riparazione delle associazioni', () => {
  it('riutilizza nomi normalizzati unici e segnala collisioni', () => {
    const person = { id: 'gianni', data: { name: 'Gianni Rosà' } },
      index = createPeopleNameIndex([person]);
    expect(matchSpeaker(' GIANNI  ROSA ', index)).toEqual({
      kind: 'matched',
      person,
    });
    const ambiguous = createPeopleNameIndex([
      person,
      { id: 'altro', data: { name: 'Gianni Rosa' } },
    ]);
    expect(matchSpeaker('Gianni Rosà', ambiguous)).toEqual({
      kind: 'ambiguous',
      ids: ['gianni', 'altro'],
    });
    expect(matchSpeaker('XE', index)).toEqual({ kind: 'organization' });
  });

  it('modifica solo speakers anche con YAML inline e altri elenchi omonimi', () => {
    const frontmatter =
      'title: Evento\nmaterials: [{label: Ada Lovelace, url: https://example.com}]\nsessions: [{title: Talk, speakers: ["Ada Lovelace", {person: grace}]}]';
    const result = parse(
      replaceSpeakerScalars(frontmatter, new Map([['ada lovelace', 'ada']])),
    );
    expect(result.materials).toEqual([
      { label: 'Ada Lovelace', url: 'https://example.com' },
    ]);
    expect(result.sessions[0].speakers).toEqual([
      { person: 'ada' },
      { person: 'grace' },
    ]);
  });

  it('simula senza scritture, crea solo profili necessari ed è idempotente', async () => {
    const { root, eventPath } = await setup(),
      original = await readFile(eventPath, 'utf8'),
      originalPerson = await readFile(
        join(root, 'src/data/people/ada.md'),
        'utf8',
      ),
      options = { root, fetchPage: async () => html };
    const dry = await enrichSpeakers(options);
    expect(dry.updatedEvents).toBe(1);
    expect(dry.created).toEqual(['Grace Hopper']);
    expect(await readFile(eventPath, 'utf8')).toBe(original);
    expect(await readdir(root)).toEqual(['src']);
    expect(await readdir(join(root, 'src/data/people'))).toEqual(['ada.md']);
    await enrichSpeakers({ ...options, write: true });
    const updated = await readFile(eventPath, 'utf8'),
      data = parse(markdownParts(updated).frontmatter);
    expect(updated).toContain('# Commento editoriale');
    expect(markdownParts(updated).remainder).toBe(
      markdownParts(original).remainder,
    );
    expect(data.sessions[0].speakers).toEqual([
      { person: 'ada' },
      { person: 'grace-hopper' },
      'XE',
    ]);
    expect(await readFile(join(root, 'src/data/people/ada.md'), 'utf8')).toBe(
      originalPerson,
    );
    const profile = await readFile(
      join(root, 'src/data/people/grace-hopper.md'),
      'utf8',
    );
    expect(parse(markdownParts(profile).frontmatter)).toMatchObject({
      name: 'Grace Hopper',
      sourceUrl: 'https://example.com/evento/',
    });
    const second = await enrichSpeakers({ ...options, write: true });
    expect(second.updatedEvents).toBe(0);
    expect(second.created).toEqual([]);
    expect(await readFile(eventPath, 'utf8')).toBe(updated);
    expect(
      await readFile(join(root, 'src/data/people/grace-hopper.md'), 'utf8'),
    ).toBe(profile);
  });

  it('lascia in testo i nomi ambigui senza creare un terzo profilo', async () => {
    const { root, eventPath } = await setup();
    await writeFile(
      join(root, 'src/data/people/ada-seconda.md'),
      '---\nname: ADA LOVELACE\nsortName: ADA LOVELACE\npublished: true\nlinks: []\n---\n',
    );
    const result = await enrichSpeakers({
      root,
      write: true,
      fetchPage: async () => html,
    });
    expect(result.warnings.join(',')).toContain('corrispondenza ambigua');
    expect(result.created).toEqual(['Grace Hopper']);
    const data = parse(
      markdownParts(await readFile(eventPath, 'utf8')).frontmatter,
    );
    expect(data.sessions[0].speakers[0]).toBe('Ada Lovelace');
    expect(await readdir(join(root, 'src/data/people'))).toHaveLength(3);
  });

  it('conserva eventi e profili quando la fonte non è disponibile', async () => {
    const { root, eventPath } = await setup(),
      before = await readFile(eventPath, 'utf8');
    const result = await enrichSpeakers({
      root,
      write: true,
      fetchPage: async () => {
        throw new Error('503');
      },
    });
    expect(result.updatedEvents).toBe(0);
    expect(result.warnings.join(',')).toContain('503');
    expect(await readFile(eventPath, 'utf8')).toBe(before);
  });

  it('conserva l’agenda Blazor Conf 2026 verificata sulla fonte esterna', async () => {
    const fixture = JSON.parse(
        await readFile(
          new URL(
            'fixtures/speakers/blazorconf-2026-agenda.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ),
      content = parse(
        markdownParts(
          await readFile(
            new URL(
              '../src/data/events/2026/2026-04-10-blazorconf2026.md',
              import.meta.url,
            ),
            'utf8',
          ),
        ).frontmatter,
      );
    expect(content.date).toBe(fixture.date);
    expect(content.sessions).toHaveLength(13);
    expect(
      content.sessions.map((session: { title: string; time: string }) => ({
        title: session.title,
        time: session.time,
      })),
    ).toEqual(
      fixture.sessions.map((session: { title: string; time: string }) => ({
        title: session.title,
        time: session.time,
      })),
    );
    expect(
      content.sessions.flatMap((session: { speakers: { person: string }[] }) =>
        session.speakers.map((speaker) => speaker.person),
      ),
    ).toEqual([
      'michele-aponte',
      'alberto-acerbis',
      'alberto-mori',
      'andrea-dottor',
      'marco-alquati',
      'alessio-iafrate',
      'nicola-paro',
      'simone-tolotti',
    ]);
  });

  it('collega i dieci talk ripristinati ai ruoli e alla cronologia degli speaker', async () => {
    const path = new URL(
        '../src/data/events/2023/2023-05-20-one-day-app-modernization.md',
        import.meta.url,
      ),
      data = parse(markdownParts(await readFile(path, 'utf8')).frontmatter),
      talks = data.sessions.filter(
        (session: { speakers: unknown[] }) => session.speakers.length > 0,
      );
    expect(talks).toHaveLength(10);
    const expected = [
      'gianluca-sartori',
      'luca-del-puppo',
      'alessandro-melchiori',
      'daniele-morosinotto',
      'andrea-dottor',
      'davide-contin',
      'massimo-bonanni',
      'mirco-vanini',
      'marco-bortolin',
      'giorgio-boa',
    ];
    expect(
      talks.flatMap((session: { speakers: { person: string }[] }) =>
        session.speakers.map((speaker) => speaker.person),
      ),
    ).toEqual(expected);
    const event = {
      id: 'example',
      data: { ...data, date: new Date(data.date) },
    } as TalkEvent;
    expect([...createSpeakerIds([event])]).toEqual(expected);
    expect(
      recentEventsForPerson({ id: 'davide-contin' } as PersonEntry, [event]),
    ).toEqual([event]);
    for (const id of expected)
      await expect(
        readFile(
          new URL(`../src/data/people/${id}.md`, import.meta.url),
          'utf8',
        ),
      ).resolves.toContain('name:');
  });
});
