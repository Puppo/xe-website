import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import {
  eventInputSchema,
  locationSchema,
  partnerSchema,
  personSchema,
  siteSchema
} from '../src/content-schemas.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'schemas');
const id = z.string().min(1);
const schemas = {
  'event.schema.json': ['Evento XeDotNet', eventInputSchema],
  'person.schema.json': ['Profilo pubblico XeDotNet', personSchema],
  'partners.schema.json': ['Partner XeDotNet', z.array(partnerSchema.extend({ id }))],
  'locations.schema.json': ['Località aggregate XeDotNet', z.array(locationSchema.extend({ id }))],
  'site.schema.json': ['Configurazione XeDotNet', z.array(siteSchema.extend({ id }))]
};

await mkdir(output, { recursive: true });

for (const [filename, [title, schema]] of Object.entries(schemas)) {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input' });
  jsonSchema.$id = `https://www.xedotnet.org/schemas/${filename}`;
  jsonSchema.title = title;
  await writeFile(join(output, filename), `${JSON.stringify(jsonSchema, null, 2)}\n`);
}

console.log(`Generati ${Object.keys(schemas).length} JSON Schema in schemas/.`);
