import { describe, expect, it } from 'vitest';
import {
  chooseKnownProfileUrl,
  extractLegacySpeakerCandidates,
  isUsableSpeakerImage,
  markdownParts,
  replaceSpeakerScalars,
  selectImageCandidate,
} from '../scripts/lib/speaker-enrichment.mjs';

describe('speaker enrichment', () => {
  it('estrae solo foto associate a un singolo speaker', () => {
    const html = `
      <article class="maincontent">
        <div class="row"><div class="col-md-3"><img src="/media/42/ada.jpg?height=200"><span>Ada Lovelace</span></div><div class="col-md-9">Talk</div></div>
        <div class="row"><div class="col-md-3"><img src="/media/1009/xe_new_3.png"><span>Grace Hopper & Alan Turing</span></div><div class="col-md-9">Panel</div></div>
      </article>`;
    expect(
      extractLegacySpeakerCandidates(
        html,
        'https://www.xedotnet.org/eventi/test/',
      ),
    ).toEqual([
      {
        imageUrl: 'https://www.xedotnet.org/media/42/ada.jpg',
        name: 'Ada Lovelace',
        pageUrl: 'https://www.xedotnet.org/eventi/test/',
      },
    ]);
  });

  it('rifiuta loghi e seleziona solo candidati non ambigui', () => {
    expect(isUsableSpeakerImage('/media/1009/xe_new_3.png')).toBe(false);
    expect(isUsableSpeakerImage('/media/42/ada.jpg')).toBe(true);
    expect(
      selectImageCandidate([
        { imageUrl: 'https://example.com/a.jpg' },
        { imageUrl: 'https://example.com/a.jpg' },
      ]),
    ).toBe('https://example.com/a.jpg');
    expect(
      selectImageCandidate([
        { imageUrl: 'https://example.com/a.jpg' },
        { imageUrl: 'https://example.com/b.jpg' },
      ]),
    ).toBeUndefined();
  });

  it('sostituisce solo gli scalari speaker e preserva il resto del frontmatter', () => {
    const source =
        'title: Evento\nsessions:\n  - title: Talk\n    speakers:\n      - Ada Lovelace\n    description: Test',
      result = replaceSpeakerScalars(
        source,
        new Map([['ada lovelace', 'ada-lovelace']]),
      );
    expect(result).toBe(
      'title: Evento\nsessions:\n  - title: Talk\n    speakers:\n      - person: ada-lovelace\n    description: Test',
    );
  });

  it('preserva integralmente il corpo Markdown', () => {
    const source = '---\ntitle: Evento\n---\n\nCorpo con **formattazione**.\n';
    expect(markdownParts(source).remainder).toBe(
      '\n\nCorpo con **formattazione**.\n',
    );
  });

  it('preferisce LinkedIn fra i collegamenti noti', () => {
    expect(
      chooseKnownProfileUrl([
        { label: 'Blog', url: 'https://example.com' },
        { label: 'LinkedIn', url: 'https://linkedin.com/in/ada' },
      ]),
    ).toBe('https://linkedin.com/in/ada');
  });
});
