import { z } from 'astro/zod';

export const linkSchema = z.object({
  label: z.string(),
  url: z.url()
});

export const sessionSchema = z.object({
  time: z.string().optional(),
  title: z.string(),
  speakers: z.array(z.string()).default([]),
  description: z.string().optional()
});

const eventFields = <T extends z.ZodType>(dateSchema: T) => ({
  title: z.string(),
  description: z.string(),
  date: dateSchema,
  endDate: dateSchema.optional(),
  eventType: z.string().optional(),
  venue: z.object({
    name: z.string(),
    url: z.url().optional(),
    online: z.boolean().default(false)
  }).optional(),
  image: z.string().optional(),
  sessions: z.array(sessionSchema).default([]),
  materials: z.array(linkSchema).default([]),
  registration: z.object({
    status: z.enum(['not-open', 'open', 'sold-out', 'closed']),
    url: z.url().optional(),
    label: z.string().optional()
  }),
  sourceUrl: z.url(),
  draft: z.boolean().default(false)
});

const eventDateSchema = z.coerce.date();
export const eventSchema = z.object(eventFields(eventDateSchema));
export const eventInputSchema = z.object(eventFields(z.iso.date()));

export const personSchema = z.object({
  name: z.string(),
  sortName: z.string(),
  title: z.string().optional(),
  image: z.string().optional(),
  roles: z.array(z.enum(['member', 'speaker'])).min(1),
  links: z.array(linkSchema).default([]),
  published: z.boolean().default(true),
  sourceUrl: z.url().optional()
});

export const partnerSchema = z.object({
  name: z.string(),
  url: z.url(),
  image: z.string().optional(),
  kind: z.enum(['sponsor', 'supporter'])
});

export const locationSchema = z.object({
  name: z.string(),
  count: z.number().int().positive(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100)
});

export const pageSchema = z.object({
  title: z.string(),
  description: z.string()
});

export const siteSchema = z.object({
  name: z.string(),
  description: z.string(),
  email: z.email(),
  address: z.string(),
  fiscalCode: z.string(),
  navigation: z.array(z.object({ label: z.string(), href: z.string() })),
  socials: z.array(linkSchema),
  newsletterAction: z.url(),
  newsletterHoneypot: z.string(),
  membershipButtonId: z.string(),
  donationButtonId: z.string()
});
