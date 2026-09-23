import type { CollectionEntry } from 'astro:content';

export type LocationEntry = CollectionEntry<'locations'>;

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  province: string;
}

const RING_RADIUS_DEGREES = 0.09;

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function locationPins(locations: LocationEntry[]): MapPin[] {
  return locations.flatMap(({ id, data }) =>
    Array.from({ length: data.count }, (_, pinIndex) => {
      const radius = data.count === 1 ? 0 : RING_RADIUS_DEGREES,
        angle = (pinIndex * 360) / data.count,
        radians = (angle * Math.PI) / 180;
      return {
        id: `${id}-${pinIndex}`,
        latitude: round(data.latitude + radius * Math.cos(radians)),
        longitude: round(data.longitude + radius * Math.sin(radians)),
        province: data.province,
      };
    }),
  );
}
