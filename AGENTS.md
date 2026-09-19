# AGENTS.md

## Project overview

XeDotNet is an Italian-language community website built as a static Astro 7 site. It uses strict TypeScript, Astro content collections, Zod schemas, Markdown and JSON content, Vitest unit tests, and Playwright browser and accessibility tests. GitHub Actions builds and deploys the generated `dist/` directory to GitHub Pages.

This is a single-package npm repository. Use Node.js 24 or newer and npm; do not introduce another package manager or lockfile.

## Repository map

- `src/pages/`: file-based Astro routes.
- `src/components/`: reusable Astro components and limited client-side behavior.
- `src/layouts/`: shared page layouts.
- `src/lib/`: event, text, URL, and deployment helpers.
- `src/data/`: Markdown content and shared JSON data.
- `src/content-schemas.ts`: canonical Zod definitions for all content.
- `src/content.config.ts`: Astro content collection loaders.
- `src/styles/global.css`: global design tokens, layout, and component styles.
- `schemas/`: generated JSON Schemas for editor support; do not edit them by hand.
- `tests/`: Vitest tests; `tests/e2e/`: Playwright and axe accessibility tests.
- `scripts/`: schema generation, build verification, URL rewriting, and legacy-site migration utilities.
- `CONTEXT.md`: canonical Italian event and registration terminology.

## Setup and development

Install exactly the locked dependencies:

```sh
npm ci
```

Start the Astro development server:

```sh
npm run dev
```

Optional local configuration belongs in an untracked `.env` copied from `.env.example`:

- `PUBLIC_CONTACT_FORM_ACTION` enables the public contact form; without it the site provides an email fallback.
- `SITE_URL` is the complete public origin and optional base path used for assets, navigation, canonical URLs, the sitemap, and `robots.txt`.

Never commit `.env`, credentials, tokens, or private form endpoints.

## Content and domain rules

- Keep user-facing copy, metadata, test descriptions, and domain vocabulary in Italian unless a requested change explicitly requires another language.
- Use the terms in `CONTEXT.md`. In particular, preserve the distinction between scheduled and cancelled events and derive registration availability from its inclusive date interval rather than a manually maintained status.
- Event Markdown lives at `src/data/events/<year>/<date>-<slug>.md`; people and page Markdown live under `src/data/people/` and `src/data/pages/`; shared structured data lives in `src/data/*.json`.
- Treat `src/content-schemas.ts` as the schema source of truth. When it changes, run `npm run schemas` and commit the corresponding generated changes in `schemas/`.
- Content that fails a collection schema must fail the build. Do not bypass validation with casts, permissive schemas, or duplicated validation logic.
- Preserve historical content, slugs, source URLs, and public URL compatibility unless the task explicitly calls for a migration.
- `npm run migrate` fetches the legacy website and rewrites event, people, media, and migration-report files. Do not run it unless the user explicitly requests a full migration or refresh and understands the resulting broad changes.

## Code conventions

- Follow the repository's existing ESM style, strict TypeScript configuration, two-space indentation, single quotes, and semicolons. The `.oxfmtrc.json` configuration is the source of truth for formatting; running `npm run format` applies it.
- Strict linting is enforced via `oxlint` (configuration in `.oxlintrc.json` with every category enabled as `error`). Run `npm run lint` to inspect and `npm run lint:fix` to autofix. Both `oxlint` and `oxfmt` are wired into the pre-commit hook through `lefthook`, so every commit runs lint autofix, format, lint verify, and format verify on the staged JS/TS files before it is recorded. A commit that fails any of these checks is rejected.
- `.astro` files are not yet supported by `oxlint` or `oxfmt`; they remain covered by `astro check` (see `npm run check`) and by hand-formatting to match the surrounding style.
- Prefer small typed helpers in `src/lib/` and keep Astro components focused on rendering and progressive enhancement.
- Reuse content schemas and shared URL/deployment helpers instead of recreating their rules in pages or components.
- Preserve static output, trailing-slash URLs, and operation under both a root domain and a GitHub Pages subpath. Do not hard-code root-relative deployment assumptions.
- Keep pages semantic and keyboard accessible. Every page should retain one meaningful `h1`; interactive controls need accessible names, visible focus behavior, and non-JavaScript or textual fallbacks where applicable.
- Third-party resources with privacy implications, such as map tiles, must remain opt-in rather than loading before user activation.

## UI workflow

When the agent environment provides these skills:

- Use `modern-web-guidance` before HTML, CSS, or client-side JavaScript work.
- Use `frontend-design` when creating new UI or substantially reshaping an existing interface.
- Use `web-design-guidelines` when reviewing UI, UX, responsiveness, or accessibility.
- For small content-only or non-visual changes, do not invoke UI skills unnecessarily.

If a named skill is unavailable, follow the same intent using current platform documentation, existing repository patterns, and the project's Playwright and axe checks.

## Generated output and deployment

`npm run build` runs `npm run schemas` through the `prebuild` hook, then runs `astro check` and creates the static site in `dist/`. After building, validate generated links and deployment paths with:

```sh
npm run check:build
```

The deployment workflow sets `SITE_URL` from the repository variable or the GitHub Pages URL. Changes to routing, assets, canonical metadata, feeds, sitemap behavior, or `robots.txt` must work with both a domain root and a non-root base path.

Do not commit `dist/`, `.astro/`, Playwright reports, test results, coverage output, or dependency directories.

## Testing and verification

Use the smallest relevant check while iterating, then run every required check for the affected area.

```sh
npm test                       # all Vitest unit tests
npm run check                  # Astro and TypeScript checks
npm run lint                   # strict oxlint over every JS/TS source file
npm run format:check           # verify oxfmt would not change any file
npm run build                  # schemas, type checks, and static production build
npm run check:build            # validate URLs in the completed dist/ build
npm run test:e2e               # all Playwright projects; requires a completed dist/ build
```

`lint` and `format:check` also run in the `Checks` GitHub Actions workflow (a dedicated `lint` job, parallel to `test` and `build`); both must be clean before a PR can merge.

Useful focused commands:

```sh
npx vitest run tests/events.test.ts
npx playwright test --project=chromium
npx playwright test tests/e2e/site.spec.ts --project=chromium
```

Install Playwright's Chromium runtime when it is not already available:

```sh
npx playwright install --with-deps chromium
```

Apply these change-specific expectations:

- Domain helpers, date/registration behavior, schema validation, or Markdown text extraction: add or update Vitest coverage and run `npm test`.
- Content or schema changes: run `npm run build` and `npm run check:build`; confirm generated schema changes are intentional.
- Pages, components, styles, navigation, theme behavior, responsive behavior, or accessibility: run the build plus the relevant Playwright tests. Preserve the existing axe WCAG A/AA checks.
- URL, base-path, sitemap, canonical, or deployment changes: test with an explicit `SITE_URL` that includes a subpath as well as the default root deployment.

Before handing off a normal change, run at least `npm test`, `npm run build`, and `npm run check:build`. Run the Chromium Playwright suite for any browser-visible change. Report any check that could not be run and the concrete environmental reason.

## Change discipline

- Keep changes scoped to the request and preserve unrelated work in the worktree.
- Update tests and documentation when behavior or contributor workflows change.
- Review generated or bulk content diffs before accepting them; do not hide unexpected generated changes.
- Follow the repository's Conventional Commit history, using messages such as `feat(events): ...`, `fix(map): ...`, or `docs(agents): ...`.
- Do not create vendor-specific AI instruction files. This root `AGENTS.md` is the canonical instruction source for coding agents working anywhere in this repository.
