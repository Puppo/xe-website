# XeDotNet

XeDotNet's static website, built with Astro and validated at build time.

## Development

```sh
npm ci
npm run dev
```

The main commands are:

- `npm run check`: run TypeScript and Astro checks.
- `npm run schemas`: generate the JSON Schemas used by the editor from the Zod schemas.
- `npm test`: run unit tests.
- `npm run build`: create a complete static build.
- `npm run test:e2e`: run browser and accessibility tests.
- `npm run migrate`: recreate events, people, and the migration report from the previous website.

To enable the contact form, copy `.env.example` to `.env` and set `PUBLIC_CONTACT_FORM_ACTION` to the public Formspree endpoint. If the endpoint is not configured, the site displays a working email link instead.

Configure the public address with `SITE_URL`, including any subdirectory; for example, `https://puppo.github.io/xe-website/`. The build uses this single value for assets, navigation, canonical URLs, the sitemap, and `robots.txt`. The GitHub Pages workflow detects the value automatically; the `SITE_URL` repository variable can override it when the domain changes. To switch to the final domain, configure it in the GitHub Pages settings—no code changes are required.

## Content

- Event Markdown: `src/data/events/<year>/<date>-<event-name>.md` (for example, `2026/2026-04-10-blazorconf2026.md`)
- People Markdown: `src/data/people/` (metadata in the YAML frontmatter and biography in the body)
- Page Markdown: `src/data/pages/`
- Shared configuration and data: `src/data/*.json`

Schemas are defined in `src/content-schemas.ts` and connected to the content collections in `src/content.config.ts`. An invalid entry causes the build to fail. The JSON Schemas in `schemas/` are regenerated automatically before each build; editor completion mappings are configured in `.vscode/settings.json`.
