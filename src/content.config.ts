import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import {
  eventSchema,
  locationSchema,
  pageSchema,
  partnerSchema,
  personSchema,
  siteSchema
} from './content-schemas';

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/events' }),
  schema: eventSchema
});

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/people' }),
  schema: personSchema
});

const partners = defineCollection({
  loader: file('./src/data/partners.json'),
  schema: partnerSchema
});

const locations = defineCollection({
  loader: file('./src/data/locations.json'),
  schema: locationSchema
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/pages' }),
  schema: pageSchema
});

const site = defineCollection({
  loader: file('./src/data/site.json'),
  schema: siteSchema
});

export const collections = { events, people, partners, locations, pages, site };
