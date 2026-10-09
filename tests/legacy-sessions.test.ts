import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractExplicitLists,
  extractRowSessions,
  extractSessionizeSessions,
  mergeSessions,
  recoverLegacySessions,
  sessionizeUrls,
} from '../scripts/lib/legacy-sessions.mjs';

const fixture = (name: string) =>
  readFileSync(
    new URL(`fixtures/speakers/${name}.html`, import.meta.url),
    'utf8',
  );
const source = 'https://www.xedotnet.org/eventi/test/';

describe('recupero delle sessioni storiche', () => {
  it('recupera le righe legacy con più speaker e organizzazioni', () => {
    expect(extractRowSessions(fixture('legacy-rows'))).toEqual([
      {
        title: 'Talk',
        time: '18:00',
        description: 'Descrizione originale.',
        speakers: ['Ada Lovelace', 'Gianni Rosà'],
      },
      { title: 'Saluti', time: '19:00', speakers: ['XE'] },
    ]);
  });

  it('recupera tutte le dieci sessioni dell’esempio e i cinque momenti di servizio', () => {
    const sessions = extractSessionizeSessions(
      fixture('app-modernization-agenda'),
    );
    expect(sessions).toHaveLength(15);
    expect(
      sessions.filter(
        (session: { speakers: string[] }) => session.speakers.length > 0,
      ),
    ).toHaveLength(10);
    expect(sessions).toContainEqual({
      title: 'Modernize your community',
      time: '14:10',
      speakers: ['Davide Contin'],
    });
    expect(sessions[0]).toEqual({
      title: 'Registrazione',
      time: '08:30',
      speakers: [],
    });
    expect(
      extractSessionizeSessions(fixture('app-modernization-agenda').repeat(2)),
    ).toEqual(sessions);
  });

  it('preferisce l’agenda completa e riconosce link ed embed senza eseguire JavaScript', async () => {
    const html = `${fixture('explicit-lists')}<script src="https://sessionize.com/api/v2/test/view/GridSmart"></script><a href="https://sessionize.com/api/v2/test/view/GridSmart">Agenda</a>`;
    expect(sessionizeUrls(html, source)).toEqual([
      'https://sessionize.com/api/v2/test/view/GridSmart?under=True',
    ]);
    const result = await recoverLegacySessions(
      html,
      source,
      'Evento',
      async () => fixture('app-modernization-agenda'),
    );
    expect(result.kind).toBe('Sessionize');
    expect(result.sessions).toHaveLength(15);
    expect(result.warnings).toEqual([]);
  });

  it('deduplica identificativi tra più viste e segnala i nomi ripetuti nella fonte', async () => {
    const html =
      '<script src="https://sessionize.com/api/v2/test/view/GridSmart"></script><a href="https://sessionize.com/api/v2/test/view/GridTable">Agenda</a>';
    const result = await recoverLegacySessions(
      html,
      source,
      'Evento',
      async () => fixture('app-modernization-agenda'),
    );
    expect(result.sessions).toHaveLength(15);
    expect(result.warnings).toEqual([]);
    const warnings: string[] = [];
    const duplicates =
      '<div class="sz-session" data-sessionid="1"><h3 class="sz-session__title">Talk</h3><ul class="sz-session__speakers"><li>Ada</li><li>Ada</li></ul></div>';
    expect(
      extractSessionizeSessions(duplicates, new Set(), warnings)[0].speakers,
    ).toEqual(['Ada']);
    expect(warnings.join(',')).toContain('nome speaker ripetuto');
  });

  it('segnala agende esterne e risposte vuote senza attribuire speaker inventati', async () => {
    const html =
      '<article class="maincontent"><p>L’agenda è disponibile <a href="https://example.com/agenda">qui</a>.</p></article><script src="https://sessionize.com/api/v2/test/view/GridSmart"></script>';
    const result = await recoverLegacySessions(
      html,
      source,
      'Evento',
      async () => '',
    );
    expect(result.sessions).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it('usa solo elenchi espliciti e ignora nomi nelle biografie e nei paragrafi', () => {
    expect(extractExplicitLists(fixture('explicit-lists'), 'Evento')).toEqual([
      { title: 'Talk', speakers: ['Ada Lovelace', 'Gianni Rosà'] },
      { title: 'Evento', speakers: ['Grace Hopper'] },
    ]);
    expect(extractExplicitLists(fixture('member-meeting'), 'Riunione')).toEqual(
      [],
    );
  });

  it('segnala fonti non disponibili e conserva le sessioni esistenti', async () => {
    const result = await recoverLegacySessions(
      '<script src="https://sessionize.com/api/v2/test/view/GridSmart"></script>',
      source,
      'Evento',
      async () => {
        throw new Error('503');
      },
    );
    expect(result.warnings.join(',')).toContain('503');
    const existing = [
      {
        title: 'Talk',
        speakers: [{ person: 'ada' }],
        time: '18:00',
        description: 'Testo editoriale',
      },
    ];
    expect(mergeSessions(existing, result.sessions)).toEqual(existing);
    const merged = mergeSessions(
      existing,
      [
        { title: 'Talk', time: '17:00', speakers: ['Grace Hopper'] },
        {
          title: 'Talk',
          time: '18:00',
          speakers: ['Ada Lovelace', 'Grace Hopper'],
        },
      ],
      new Map([['ada', 'Ada Lovelace']]),
    );
    expect(merged[0]).toEqual({
      ...existing[0],
      speakers: [{ person: 'ada' }, 'Grace Hopper'],
    });
    expect(merged).toHaveLength(2);
    expect(existing[0].speakers).toEqual([{ person: 'ada' }]);
  });

  it('conserva pause ripetute a orari diversi ed evita associazioni ambigue', () => {
    const sessions = [
      { title: 'Pausa', time: '10:00', speakers: [] },
      { title: 'Pausa', time: '15:00', speakers: [] },
    ];
    expect(mergeSessions([], sessions)).toEqual(sessions);
    expect(mergeSessions(sessions, sessions)).toEqual(sessions);
    const parallel = [
      { title: 'Panel', time: '10:00', speakers: ['Ada'] },
      { title: 'Panel', time: '10:00', speakers: ['Grace'] },
    ];
    expect(mergeSessions([], parallel)).toEqual(parallel);
    expect(mergeSessions(parallel, parallel)).toEqual(parallel);
    const ambiguous = [
      { title: 'Talk', speakers: [] },
      { title: 'Talk', speakers: [] },
    ];
    expect(
      mergeSessions(ambiguous, [{ title: 'Talk', speakers: ['Ada'] }]),
    ).toEqual(ambiguous);
  });
});
