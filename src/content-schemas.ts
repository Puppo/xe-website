import { z } from 'astro/zod';

export const linkSchema = z.object({
  label: z.string(),
  url: z.url(),
});

export const speakerInputSchema = z.union([
  z.string(),
  z.object({ person: z.string().min(1) }),
]);

export const createSessionSchema = <T extends z.ZodType>(speakerSchema: T) =>
  z.object({
    description: z.string().optional(),
    speakers: z.array(speakerSchema).default([]),
    time: z.string().optional(),
    title: z.string(),
  });

export const sessionSchema = createSessionSchema(speakerInputSchema);

const eventFields = <T extends z.ZodType, U extends z.ZodType>(
  dateSchema: T,
  speakerSchema: U,
) => ({
  date: dateSchema,
  description: z.string(),
  draft: z.boolean().default(false),
  endDate: dateSchema.optional(),
  eventType: z.string().optional(),
  image: z.string().optional(),
  materials: z.array(linkSchema).default([]),
  registration: z
    .object({
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      url: z.url().optional(),
      label: z.string().optional(),
    })
    .default({}),
  sessions: z.array(createSessionSchema(speakerSchema)).default([]),
  sourceUrl: z.url(),
  status: z.enum(['scheduled', 'cancelled']).default('scheduled'),
  title: z.string(),
  venue: z
    .object({
      name: z.string(),
      url: z.url().optional(),
      online: z.boolean().default(false),
    })
    .optional(),
});

function dateValue(value: unknown): number {
  return value instanceof Date
    ? value.getTime()
    : new Date(String(value)).getTime();
}

export function createEventSchema<T extends z.ZodType, U extends z.ZodType>(
  dateSchema: T,
  speakerSchema: U,
) {
  return z
    .object(eventFields(dateSchema, speakerSchema))
    .superRefine((event, context) => {
      const eventData = event as unknown as {
          date: unknown;
          endDate?: unknown;
          registration: {
            startDate?: unknown;
            endDate?: unknown;
            url?: string;
          };
        },
        { startDate, endDate, url } = eventData.registration;

      if ((startDate && !endDate) || (!startDate && endDate)) {
        context.addIssue({
          code: 'custom',
          message:
            'Le date di apertura e chiusura delle iscrizioni devono essere indicate insieme.',
          path: ['registration'],
        });
        return;
      }

      if (!startDate || !endDate) {
        return;
      }

      if (!url) {
        context.addIssue({
          code: 'custom',
          message: 'Un periodo di iscrizione richiede un URL.',
          path: ['registration', 'url'],
        });
      }

      if (dateValue(startDate) > dateValue(endDate)) {
        context.addIssue({
          code: 'custom',
          message:
            'La data di apertura delle iscrizioni deve precedere quella di chiusura.',
          path: ['registration', 'startDate'],
        });
      }

      if (dateValue(endDate) > dateValue(eventData.endDate ?? eventData.date)) {
        context.addIssue({
          code: 'custom',
          message: 'Le iscrizioni devono chiudersi entro la fine dell’evento.',
          path: ['registration', 'endDate'],
        });
      }
    });
}

export const eventDateSchema = z.coerce.date();
export const eventSchema = createEventSchema(
  eventDateSchema,
  speakerInputSchema,
);
export const eventInputSchema = createEventSchema(
  z.iso.date(),
  speakerInputSchema,
);

export const personSchema = z.strictObject({
  image: z.string().optional(),
  links: z.array(linkSchema).default([]),
  name: z.string(),
  profileUrl: z.url().optional(),
  published: z.boolean().default(true),
  sortName: z.string(),
  sourceUrl: z.url().optional(),
  title: z.string().optional(),
});

export const partnerSchema = z.object({
  image: z.string().optional(),
  imageHeight: z.number().int().positive().optional(),
  imageWidth: z.number().int().positive().optional(),
  kind: z.enum(['sponsor', 'supporter']),
  name: z.string(),
  order: z.number().int().positive().optional(),
  published: z.boolean().default(true),
  url: z.url(),
});

export const locationSchema = z.object({
  count: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  municipality: z.string(),
  province: z.string(),
});

export const pageSchema = z.object({
  description: z.string(),
  title: z.string(),
});

export const siteSchema = z.object({
  address: z.string(),
  description: z.string(),
  donationButtonId: z.string(),
  email: z.email(),
  fiscalCode: z.string(),
  membershipButtonId: z.string(),
  name: z.string(),
  navigation: z.array(z.object({ label: z.string(), href: z.string() })),
  newsletterAction: z.url(),
  newsletterHoneypot: z.string(),
  socials: z.array(linkSchema),
  tagline: z.string(),
});

export function createMembershipSchema<
  T extends z.ZodType<string | { id: string }>,
>(memberSchema: T) {
  return z
    .object({
      members: z.array(memberSchema, { error: 'Indicare l’elenco dei soci.' }),
    })
    .superRefine((membership, context) => {
      const seen = new Set<string>();
      let previous: string | undefined;
      for (const [index, member] of membership.members.entries()) {
        const id = typeof member === 'string' ? member : member.id;
        if (seen.has(id)) {
          context.addIssue({
            code: 'custom',
            message: `Il socio "${id}" è presente più volte.`,
            path: ['members', index],
          });
        }
        if (previous !== undefined && previous > id) {
          context.addIssue({
            code: 'custom',
            message: 'Gli slug dei soci devono essere in ordine alfabetico.',
            path: ['members', index],
          });
        }
        seen.add(id);
        previous = id;
      }
    });
}

export const membershipInputSchema = createMembershipSchema(z.string().min(1));
