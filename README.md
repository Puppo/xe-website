# XeDotNet

Sito statico di XeDotNet, costruito con Astro e contenuti validati durante la build.

## Sviluppo

```sh
npm install
npm run dev
```

I comandi principali sono:

- `npm run check`: controlli TypeScript e Astro.
- `npm run schemas`: genera i JSON Schema usati dall’editor a partire dagli schemi Zod.
- `npm test`: test unitari.
- `npm run build`: build statica completa.
- `npm run test:e2e`: test browser e accessibilità.
- `npm run migrate`: ricrea eventi, soci e rapporto di migrazione dal sito precedente.

Per abilitare il form dei contatti, copia `.env.example` in `.env` e imposta `PUBLIC_CONTACT_FORM_ACTION` con l’endpoint Formspree pubblico. In assenza dell’endpoint viene mostrato un collegamento email utilizzabile.

L’indirizzo pubblico è configurato con `SITE_URL`, includendo l’eventuale sottocartella: per esempio `https://puppo.github.io/xe-website/`. La build usa questo unico valore per asset, navigazione, URL canonici, sitemap e `robots.txt`. Nel workflow GitHub Pages il valore viene rilevato automaticamente; la variabile di repository `SITE_URL` può sovrascriverlo quando cambia il dominio. Per passare al dominio definitivo basta configurarlo nelle impostazioni GitHub Pages: non è necessario modificare il codice.

## Contenuti

- Eventi Markdown: `src/data/events/`
- Persone JSON: `src/data/people/`
- Pagine Markdown: `src/data/pages/`
- Configurazione e dati condivisi: `src/data/*.json`

Gli schemi sono definiti in `src/content-schemas.ts` e collegati alle content collection in `src/content.config.ts`. Una voce non valida interrompe la build. I JSON Schema in `schemas/` vengono rigenerati automaticamente prima della build; le associazioni per il completamento dell’editor sono in `.vscode/settings.json`.
