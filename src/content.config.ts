import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { file, glob } from 'astro/loaders';
import {
  createEventSchema,
  eventDateSchema,
  locationSchema,
  pageSchema,
  partnerSchema,
  personSchema,
  siteSchema,
} from './content-schemas';

const events = defineCollection({
    loader: glob({ base: './src/data/events', pattern: '**/*.md' }),
    schema: createEventSchema(
      eventDateSchema,
      z.union([z.string(), z.object({ person: reference('people') })]),
    ),
  }),
  people = defineCollection({
    loader: glob({ base: './src/data/people', pattern: '**/*.md' }),
    schema: personSchema,
  }),
  partners = defineCollection({
    loader: file('./src/data/partners.json'),
    schema: partnerSchema,
  }),
  locations = defineCollection({
    loader: file('./src/data/locations.json'),
    schema: locationSchema,
  }),
  pages = defineCollection({
    loader: glob({ base: './src/data/pages', pattern: '**/*.md' }),
    schema: pageSchema,
  }),
  site = defineCollection({
    loader: file('./src/data/site.json'),
    schema: siteSchema,
  });

export const collections = { events, locations, pages, partners, people, site };
