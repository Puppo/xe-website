# Contributing to XeDotNet

Thank you for your interest in the XeDotNet community website. Contributions of all sizes are welcome — typo fixes, content updates, bug reports, accessibility improvements, and new features alike.

The project is released under the [MIT License](LICENSE).

## How can I help?

- **Found a bug or have an idea?** Open a [GitHub Issue](../../issues) and describe what you observed, what you expected, and how to reproduce it. Screenshots and the relevant URL help a lot.
- **Want to make a change?** Open a [Pull Request](../../pulls). Describe what you changed and why; include screenshots or animated GIFs for any user-visible change.
- **Not sure where to start?** Look for issues labeled `good first issue` or `help wanted`.

When you participate, please be respectful and constructive. Assume good faith, stay on topic, and welcome newcomers.

## Previewing your changes

Pull requests get an automatic preview through Netlify's GitHub integration: each PR receives a Deploy Preview at `https://deploy-preview-{N}--xe-website-preview.netlify.app/`, and Netlify's bot posts the link as a comment on the PR. The preview is updated on every push.

Fork PRs do not build automatically. A maintainer approves them by clicking the **Approve** button in Netlify's bot comment on the PR, or from the Netlify dashboard. Once approved, subsequent pushes rebuild automatically.

## Development setup

The project is a single-package npm repository. It runs on Node.js 24 or newer and uses the npm lockfile — please do not introduce another package manager or lockfile.

```sh
npm ci          # install the locked dependency tree
npm run dev     # start the Astro dev server
```

Optional local configuration goes into an untracked `.env` copied from `.env.example`:

- `PUBLIC_CONTACT_FORM_ACTION` enables the public contact form; without it the site shows an email fallback.
- `SITE_URL` is the complete public origin and optional base path used for assets, navigation, canonical URLs, the sitemap, and `robots.txt`.

Never commit `.env`, credentials, tokens, or private form endpoints.

## Conventions

- ESM, strict TypeScript, two-space indentation, single quotes, semicolons.
- There is intentionally no ESLint or Prettier — do not introduce one or invent `lint` / `format` commands.
- Keep helpers small and typed; shared helpers live in `src/lib/`.
- Avoid hard-coding deployment assumptions; the site must work both at a domain root and under a GitHub Pages subpath.

## Commits

This repository follows [Conventional Commits](https://www.conventionalcommits.org/). Existing messages use the form `type(scope): subject`, for example:

- `feat(map): render the community map immediately without an activation step`
- `fix(map): align markers with geographic coordinates`
- `docs(agents): add cross-agent repository guidance`
- `chore(github): define repository code owner`

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. Keep the subject in the imperative mood ("add", not "added").

## Content

The site is in Italian. User-facing copy, metadata, test descriptions, and domain vocabulary stay in Italian; please follow the glossary in `CONTEXT.md` (for example, *Evento programmato*, *Evento annullato*, *Periodo di iscrizione*).

Where the content lives:

- Events: `src/data/events/<year>/<date>-<slug>.md`
- People: `src/data/people/<slug>.md`
- Annual memberships: `src/data/memberships/<year>.json`
- Pages: `src/data/pages/<slug>.md`
- Shared structured data: `src/data/*.json`

`src/content-schemas.ts` is the schema source of truth. Any change that affects it must also regenerate the JSON Schemas:

```sh
npm run schemas   # writes the generated files in schemas/
```

Commit the regenerated `schemas/` output alongside the source-of-truth edit. Invalid content must fail the build — do not bypass validation with casts or permissive schemas.

## Gestione annuale dei soci

L’albo soci è un file JSON per anno associativo in `src/data/memberships/`. Il sito usa sempre l’anno più alto disponibile, indipendentemente dalla data corrente. Il 1° gennaio non cambia nulla finché non viene pubblicato un nuovo elenco. Pubblicare un file per un anno futuro attiva subito quell’elenco: prepararlo in un branch e unirlo quando deve entrare in vigore.

Esempio di `src/data/memberships/2026.json`:

```json
{
  "members": [
    "alberto-acerbis",
    "andrea-dottor",
    "michael-denny"
  ]
}
```

Per aggiornare i soci:

1. Copiare l’elenco precedente, per esempio con `cp src/data/memberships/2026.json src/data/memberships/2027.json`.
2. Aggiungere gli slug di chi ha sottoscritto la tessera e rimuovere chi non ha rinnovato. Per i nuovi profili usare nomi file minuscoli con trattini: lo slug corrisponde al nome senza `.md`: `src/data/people/andrea-dottor.md` → `andrea-dottor`.
   Tutti i nomi file devono essere in kebab case, per esempio `massimiliano-barbierato.md`, `mirko-rezzin.md` e `roberto-ferro.md`. Il build rifiuta maiuscole, punti e i vecchi identificativi migrati. L’autocompletamento JSON propone gli slug canonici. I vecchi URL dei soci hanno un redirect al nuovo indirizzo; gli endpoint JSON storici restituiscono il dettaglio con lo slug canonico. Gli alias sono pubblicati solo per i soci correnti con profilo pubblicato e non compaiono nella sitemap.
3. Per una nuova persona, creare prima il profilo Markdown in `src/data/people/`, con almeno `name` e `sortName` nel frontmatter e la biografia nel corpo. Non aggiungere `roles`: i ruoli pubblici sono derivati dai dati e il campo viene rifiutato dallo schema. `published: false` impedisce la visualizzazione anche se la persona è nell’elenco annuale.
4. Tenere gli slug in ordine alfabetico, senza duplicati. Non eliminare gli elenchi degli anni precedenti o i profili di chi non rinnova: servono per la storia associativa e gli eventi.
5. Dopo aver creato profili, eseguire `npm run schemas` per aggiornare l’autocompletamento degli slug nell’editor. Includere le modifiche generate in `schemas/` nel commit.
6. Eseguire `npm run build` e `npm run check:build`, controllare la pagina `/soci/` e aprire una pull request con le modifiche.

I nomi dei file devono essere anni di quattro cifre (`YYYY.json`), senza suffissi o sottocartelle. `members` è obbligatorio; un elenco vuoto è valido e mostra zero soci, senza recuperare l’elenco precedente. Il build fallisce se manca ogni elenco annuale, se un elenco contiene duplicati o slug fuori ordine, o se un socio non ha un profilo. I riferimenti sono controllati anche negli anni storici. Chi non compare nell’ultimo elenco non ha più una pagina pubblica `/soci/<slug>/` né un dettaglio WebMCP; il suo profilo sorgente e i riferimenti negli eventi restano disponibili.

Lo stato di speaker deriva dai riferimenti espliciti alle persone nelle sessioni degli eventi non in bozza, attraverso tutto l’archivio. In un evento, usare `person: andrea-dottor` nell’elenco `speakers` della sessione per riferirsi al profilo. Gli eventi passati, futuri e annullati contano; gli eventi con `draft: true` no. Le stringhe speaker storiche restano testo e non vengono confrontate con i nomi dei profili. Uno speaker che non rinnova resta tale, ma compare nell’elenco soci e ha una pagina pubblica solo se è anche un socio corrente pubblicato.

La migrazione completa dal vecchio sito richiede un anno esplicito:

```sh
npm run migrate -- --membership-year=2026
```

Questo comando scarica e riscrive molti contenuti, incluso l’elenco dell’anno indicato. Non usarlo per il normale aggiornamento annuale dei soci; eseguirlo solo per una migrazione completa autorizzata. Senza un anno valido il comando termina prima di scaricare o scrivere file.

## Testing and verification

Run the smallest relevant check while iterating, then the full set for the area you changed.

```sh
npm test                       # Vitest unit tests
npm run check                  # Astro and TypeScript checks
npm run build                  # prebuild schemas, astro check, and static build into dist/
npm run check:build            # validate URLs in the completed dist/ build
npm run test:e2e               # Playwright browser and axe accessibility suite; requires a completed dist/
```

Focused runs:

```sh
npx vitest run tests/events.test.ts
npx playwright test --project=chromium
```

Install Playwright's Chromium runtime on first use:

```sh
npx playwright install --with-deps chromium
```

What to run for what kind of change:

- Domain helpers, date / registration behavior, schema validation, or Markdown text extraction → update or add Vitest coverage, then `npm test`.
- Content or schema changes → `npm run build` and `npm run check:build`; review the generated schema diff.
- Pages, components, styles, navigation, theme behavior, responsiveness, or accessibility → the build plus the relevant Playwright tests. Keep the existing axe WCAG A/AA checks intact.
- URL, base-path, sitemap, canonical, or deployment changes → test with an explicit `SITE_URL` that includes a subpath as well as the default root deployment.

Before opening a pull request, run at least `npm test`, `npm run build`, and `npm run check:build`. Run the Chromium Playwright suite for any browser-visible change. If a required check could not run, say so in the PR description and explain why.

## Pull request checklist

- [ ] Change is scoped to the request; unrelated edits are split into a separate PR.
- [ ] Tests cover the new or changed behavior.
- [ ] Documentation (`README.md`, `CONTEXT.md`, this file) is updated when behavior or contributor workflows change.
- [ ] Generated or bulk content diffs have been reviewed; unexpected changes are explained.
- [ ] Commit messages follow Conventional Commits.
- [ ] `npm test`, `npm run build`, and `npm run check:build` pass locally; Playwright passes for browser-visible changes.
