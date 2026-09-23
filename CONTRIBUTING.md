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
- Pages: `src/data/pages/<slug>.md`
- Shared structured data: `src/data/*.json`

`src/content-schemas.ts` is the schema source of truth. Any change that affects it must also regenerate the JSON Schemas:

```sh
npm run schemas   # writes the generated files in schemas/
```

Commit the regenerated `schemas/` output alongside the source-of-truth edit. Invalid content must fail the build — do not bypass validation with casts or permissive schemas.

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
