import { describe, expect, it } from 'vitest';
import { locationPins } from '../src/lib/locations';
import type { LocationEntry, MapPin } from '../src/lib/locations';

function location(
  id: string,
  data: {
    count: number;
    latitude?: number;
    longitude?: number;
    province?: string;
  },
): LocationEntry {
  return {
    id,
    data: {
      count: data.count,
      latitude: data.latitude ?? 45.6669,
      longitude: data.longitude ?? 12.243,
      municipality: 'Municipio',
      province: data.province ?? `${id} e provincia`,
    },
  } as LocationEntry;
}

function distance(a: MapPin, b: MapPin): number {
  return Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude);
}

describe('località', () => {
  it('genera un pin per ogni socio della provincia', () => {
    const pins = locationPins([
      location('treviso', { count: 5 }),
      location('venezia', { count: 3 }),
      location('padova', { count: 3 }),
      location('pordenone', { count: 2 }),
      location('vicenza', { count: 1 }),
    ]);
    expect(pins).toHaveLength(14);
    expect(
      pins.filter((pin) => pin.province === 'treviso e provincia'),
    ).toHaveLength(5);
  });

  it('posiziona il pin unico esattamente sul capoluogo', () => {
    const [pin] = locationPins([
      location('vicenza', { count: 1, latitude: 45.5455, longitude: 11.5354 }),
    ]);
    expect(pin?.latitude).toBe(45.5455);
    expect(pin?.longitude).toBe(11.5354);
  });

  it('distribuisce i pin multipli su un anello attorno al capoluogo', () => {
    const base = { latitude: 45.6669, longitude: 12.243 },
      pins = locationPins([location('treviso', { count: 5, ...base })]);
    for (const pin of pins) {
      const radius = Math.hypot(
        pin.latitude - base.latitude,
        pin.longitude - base.longitude,
      );
      expect(radius).toBeGreaterThan(0.085);
      expect(radius).toBeLessThanOrEqual(0.095);
    }
  });

  it('mantiene i pin di uno stesso capoluogo distinguibili', () => {
    const pins = locationPins([location('treviso', { count: 5 })]),
      chords = pins.flatMap((a, i) =>
        pins.slice(i + 1).map((b) => distance(a, b)),
      );
    expect(Math.min(...chords)).toBeGreaterThanOrEqual(0.1);
  });

  it('produce gli stessi pin a ogni chiamata', () => {
    const locations = [
      location('treviso', { count: 5 }),
      location('padova', { count: 3 }),
    ];
    expect(locationPins(locations)).toEqual(locationPins(locations));
  });

  it('esclude i conteggi non positivi', () => {
    expect(locationPins([location('zero', { count: 0 })])).toEqual([]);
  });
});
