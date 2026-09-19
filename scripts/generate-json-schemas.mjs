import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'astro/zod';
import {
  eventInputSchema,
  locationSchema,
  partnerSchema,
  personSchema,
  siteSchema,
} from '../src/content-schemas.ts';

const root = join(import.meta.dirname, '..'),
  output = join(root, 'schemas'),
  id = z.string().min(1),
  schemas = {
    'event.schema.json': ['Evento XeDotNet', eventInputSchema],
    'locations.schema.json': [
      'Località aggregate XeDotNet',
      z.array(locationSchema.extend({ id })),
    ],
    'partners.schema.json': [
      'Partner XeDotNet',
      z.array(partnerSchema.extend({ id })),
    ],
    'person.schema.json': ['Profilo pubblico XeDotNet', personSchema],
    'site.schema.json': [
      'Configurazione XeDotNet',
      z.array(siteSchema.extend({ id })),
    ],
  };

await mkdir(output, { recursive: true });

for (const [filename, [title, schema]] of Object.entries(schemas)) {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input' });
  jsonSchema.$id = `https://www.xedotnet.org/schemas/${filename}`;
  jsonSchema.title = title;
  await writeFile(
    join(output, filename),
    `${JSON.stringify(jsonSchema, null, 2)}\n`,
  );
}

console.log(`Generati ${Object.keys(schemas).length} JSON Schema in schemas/.`);
