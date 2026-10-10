import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { personIdFromFilename } from '../src/lib/person-slugs.mjs';
import {
  createMembershipSchema,
  eventInputSchema,
  locationSchema,
  partnerSchema,
  personSchema,
  siteSchema,
} from '../src/content-schemas.ts';

const root = join(import.meta.dirname, '..'),
  output = join(root, 'schemas'),
  id = z.string().min(1),
  personIds = (await readdir(join(root, 'src/data/people')))
    .filter((filename) => filename.endsWith('.md'))
    .map((filename) => personIdFromFilename(filename))
    .sort(),
  schemas = {
    'event.schema.json': ['XeDotNet event', eventInputSchema],
    'locations.schema.json': [
      'XeDotNet location collection',
      z.array(locationSchema.extend({ id })),
    ],
    'partners.schema.json': [
      'XeDotNet partners',
      z.array(partnerSchema.extend({ id })),
    ],
    'membership.schema.json': [
      'XeDotNet annual membership',
      createMembershipSchema(z.enum(personIds)),
    ],
    'person.schema.json': ['XeDotNet public profile', personSchema],
    'site.schema.json': [
      'XeDotNet configuration',
      z.array(siteSchema.extend({ id })),
    ],
  };

await mkdir(output, { recursive: true });

for (const [filename, [title, schema]] of Object.entries(schemas)) {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input' });
  jsonSchema.$id = `https://www.xedotnet.org/schemas/${filename}`;
  jsonSchema.title = title;
  if (filename === 'membership.schema.json') {
    jsonSchema.properties.members.uniqueItems = true;
  }
  await writeFile(
    join(output, filename),
    `${JSON.stringify(jsonSchema, null, 2)}\n`,
  );
}

console.log(
  `Generated ${Object.keys(schemas).length} JSON Schemas in schemas/.`,
);
