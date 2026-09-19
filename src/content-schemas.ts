import { z } from 'astro/zod';

export const linkSchema = z.object({
  label: z.string(),
  url: z.url()
});

export const speakerInputSchema = z.union([
  z.string(),
  z.object({ person: z.string().min(1) })
]);

export const createSessionSchema = <T extends z.ZodType>(speakerSchema: T) => z.object({
  time: z.string().optional(),
  title: z.string(),
  speakers: z.array(speakerSchema).default([]),
  description: z.string().optional()
});

export const sessionSchema = createSessionSchema(speakerInputSchema);

const eventFields = <T extends z.ZodType, U extends z.ZodType>(dateSchema: T, speakerSchema: U) => ({
  title: z.string(),
  description: z.string(),
  date: dateSchema,
  endDate: dateSchema.optional(),
  status: z.enum(['scheduled', 'cancelled']).default('scheduled'),
  eventType: z.string().optional(),
  venue: z.object({
    name: z.string(),
    url: z.url().optional(),
    online: z.boolean().default(false)
  }).optional(),
  image: z.string().optional(),
  sessions: z.array(createSessionSchema(speakerSchema)).default([]),
  materials: z.array(linkSchema).default([]),
  registration: z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    url: z.url().optional(),
    label: z.string().optional()
  }).default({}),
  sourceUrl: z.url(),
  draft: z.boolean().default(false)
});

function dateValue(value: unknown): number {
  return value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
}

export function createEventSchema<T extends z.ZodType, U extends z.ZodType>(dateSchema: T, speakerSchema: U) {
  return z.object(eventFields(dateSchema, speakerSchema)).superRefine((event, context) => {
    const eventData = event as unknown as {
      date: unknown;
      endDate?: unknown;
      registration: { startDate?: unknown; endDate?: unknown; url?: string };
    };
    const { startDate, endDate, url } = eventData.registration;

    if ((startDate && !endDate) || (!startDate && endDate)) {
      context.addIssue({
        code: 'custom',
        message: 'Le date di apertura e chiusura delle iscrizioni devono essere indicate insieme.',
        path: ['registration']
      });
      return;
    }

    if (!startDate || !endDate) return;

    if (!url) {
      context.addIssue({
        code: 'custom',
        message: 'Un periodo di iscrizione richiede un URL.',
        path: ['registration', 'url']
      });
    }

    if (dateValue(startDate) > dateValue(endDate)) {
      context.addIssue({
        code: 'custom',
        message: 'La data di apertura delle iscrizioni deve precedere quella di chiusura.',
        path: ['registration', 'startDate']
      });
    }

    if (dateValue(endDate) > dateValue(eventData.endDate ?? eventData.date)) {
      context.addIssue({
        code: 'custom',
        message: 'Le iscrizioni devono chiudersi entro la fine dell’evento.',
        path: ['registration', 'endDate']
      });
    }
  });
}

export const eventDateSchema = z.coerce.date();
export const eventSchema = createEventSchema(eventDateSchema, speakerInputSchema);
export const eventInputSchema = createEventSchema(z.iso.date(), speakerInputSchema);

export const personSchema = z.object({
  name: z.string(),
  sortName: z.string(),
  title: z.string().optional(),
  image: z.string().optional(),
  profileUrl: z.url().optional(),
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
  municipality: z.string(),
  province: z.string(),
  count: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
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
