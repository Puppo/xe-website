import { describe, expect, it } from 'vitest';
import { partnerSchema } from '../src/content-schemas';

describe('schema partner', () => {
  it('pubblica i partner per impostazione predefinita', () => {
    const partner = partnerSchema.parse({
      kind: 'sponsor',
      name: 'Sessionize',
      url: 'https://sessionize.com/',
    });

    expect(partner.published).toBe(true);
  });

  it('conserva i partner storici senza mostrarli come attuali', () => {
    const partner = partnerSchema.parse({
      kind: 'supporter',
      name: 'JetBrains',
      published: false,
      url: 'https://www.jetbrains.com/',
    });

    expect(partner.published).toBe(false);
  });
});
