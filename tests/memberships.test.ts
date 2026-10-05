import { describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import { z } from 'astro/zod';
import {
  createMembershipSchema,
  membershipInputSchema,
  personSchema,
} from '../src/content-schemas';
import {
  createMembershipContext,
  currentMembers,
  isCurrentMember,
  memberSummaries,
  toMemberCatalog,
  toMemberDetails,
  toMemberSummary,
} from '../src/lib/people';
import type { PersonEntry } from '../src/lib/people';

function person(
  id: string,
  extra: Partial<PersonEntry['data']> = {},
): PersonEntry {
  return {
    collection: 'people',
    id,
    body: 'Biografia **del socio**.',
    data: personSchema.parse({ name: id, sortName: id, ...extra }),
  };
}

function annualList(
  id: string,
  members: string[],
): CollectionEntry<'memberships'> {
  return {
    collection: 'memberships',
    id,
    data: {
      members: members.map((member) => ({ collection: 'people', id: member })),
    },
  };
}

const ada = person('ada', { roles: ['speaker'] });
const bruno = person('bruno');
const hidden = person('nascosto', { published: false });
const people = [ada, bruno, hidden];
const baseUrl = 'https://example.com/community/';

// All schemas used here are the same ones that validate collection content.
describe('schema dell’albo soci', () => {
  it('richiede members e accetta un elenco vuoto', () => {
    expect(membershipInputSchema.safeParse({}).success).toBe(false);
    expect(membershipInputSchema.parse({ members: [] })).toEqual({
      members: [],
    });
  });

  it('rifiuta gli slug duplicati o fuori ordine', () => {
    expect(
      membershipInputSchema.safeParse({ members: ['ada', 'ada'] }).success,
    ).toBe(false);
    expect(
      membershipInputSchema.safeParse({ members: ['bruno', 'ada'] }).success,
    ).toBe(false);
    expect(
      membershipInputSchema.safeParse({ members: ['ada', 'bruno'] }).success,
    ).toBe(true);
  });

  it('applica gli stessi vincoli ai riferimenti Astro', () => {
    const schema = createMembershipSchema(
      z.object({ id: z.string(), collection: z.literal('people') }),
    );
    expect(
      schema.safeParse(annualList('2026', ['ada', 'ada']).data).success,
    ).toBe(false);
    expect(
      schema.safeParse(annualList('2026', ['bruno', 'ada']).data).success,
    ).toBe(false);
    expect(
      schema.safeParse(annualList('2026', ['ada', 'bruno']).data).success,
    ).toBe(true);
  });

  it('consente profili senza ruoli e rifiuta il ruolo member nel frontmatter', () => {
    expect(personSchema.parse({ name: 'Ada', sortName: 'Ada' }).roles).toEqual(
      [],
    );
    expect(
      personSchema.safeParse({
        name: 'Ada',
        sortName: 'Ada',
        roles: ['member'],
      }).success,
    ).toBe(false);
  });
});

describe('anno associativo corrente', () => {
  it('sceglie l’anno maggiore indipendentemente dall’ordine', () => {
    const membership = createMembershipContext(
      [
        annualList('2027', ['bruno']),
        annualList('2025', ['ada']),
        annualList('2026', ['ada', 'bruno']),
      ],
      people,
    );
    expect(membership.year).toBe(2027);
    expect([...membership.memberIds]).toEqual(['bruno']);
  });

  it('non cambia elenco al cambio di anno e attiva anche un anno futuro', () => {
    vi.useFakeTimers();
    try {
      for (const date of ['2026-12-31', '2027-01-01', '2028-01-01']) {
        vi.setSystemTime(new Date(date));
        expect(
          createMembershipContext([annualList('2026', ['ada'])], people).year,
        ).toBe(2026);
      }
      vi.setSystemTime(new Date('2026-01-01'));
      expect(
        createMembershipContext([annualList('2028', ['ada'])], people).year,
      ).toBe(2028);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rispetta l’ultimo elenco vuoto senza ripiegare sugli anni precedenti', () => {
    const membership = createMembershipContext(
      [annualList('2026', ['ada']), annualList('2027', [])],
      people,
    );
    expect(membership.year).toBe(2027);
    expect(currentMembers(people, membership)).toEqual([]);
  });

  it('fallisce se mancano gli elenchi annuali', () => {
    expect(() => createMembershipContext([], people)).toThrow(
      /Manca un elenco annuale/u,
    );
  });

  it.each(['202', '20266', '2026-copy', 'archivio/2026'])(
    'rifiuta il nome di anno non valido %s',
    (id) => {
      expect(() =>
        createMembershipContext([annualList(id, [])], people),
      ).toThrow(/quattro cifre/u);
    },
  );

  it.each(['2025', '2027'])(
    'rifiuta uno slug sconosciuto anche nell’anno %s',
    (year) => {
      expect(() =>
        createMembershipContext(
          [annualList(year, ['sconosciuto']), annualList('2026', ['ada'])],
          people,
        ),
      ).toThrow(
        `Anno associativo ${year}: il socio "sconosciuto" non ha un profilo.`,
      );
    },
  );

  it('valida i profili non pubblicati ma li esclude dalla visualizzazione', () => {
    const membership = createMembershipContext(
      [annualList('2026', ['ada', 'nascosto'])],
      people,
    );
    expect(currentMembers(people, membership)).toEqual([ada]);
    expect(isCurrentMember(hidden, membership)).toBe(false);
    expect(isCurrentMember(bruno, membership)).toBe(false);
  });
});

describe('catalogo dei soci correnti', () => {
  const membership = createMembershipContext(
    [annualList('2026', ['ada', 'bruno', 'nascosto'])],
    people,
  );

  it('deriva member dall’elenco e speaker dal profilo', () => {
    expect(toMemberSummary(ada, baseUrl, membership)?.roles).toEqual([
      'member',
      'speaker',
    ]);
    expect(toMemberDetails(bruno, baseUrl, membership)?.roles).toEqual([
      'member',
    ]);
    expect(
      memberSummaries(people, baseUrl, membership).map((member) => member.slug),
    ).toEqual(['ada', 'bruno']);
    expect(toMemberCatalog(ada, baseUrl, membership)?.[0]?.slug).toBe('ada');
  });

  it('esclude profili non pubblicati dai riepiloghi e dai dettagli', () => {
    expect(toMemberSummary(hidden, baseUrl, membership)).toBeUndefined();
    expect(toMemberDetails(hidden, baseUrl, membership)).toBeUndefined();
    expect(toMemberCatalog(hidden, baseUrl, membership)).toBeUndefined();
  });

  it('rimuove chi non rinnova e conserva il suo ruolo speaker', () => {
    const next = createMembershipContext(
      [annualList('2026', ['ada', 'bruno']), annualList('2027', ['bruno'])],
      people,
    );
    expect(
      memberSummaries(people, baseUrl, next).map((member) => member.slug),
    ).toEqual(['bruno']);
    expect(toMemberSummary(ada, baseUrl, next)).toBeUndefined();
    expect(toMemberDetails(ada, baseUrl, next)).toBeUndefined();
    expect(toMemberCatalog(ada, baseUrl, next)).toBeUndefined();
    expect(ada.data.roles).toEqual(['speaker']);
  });
});
