# WebMCP implementation verification

Date: October 10, 2026. Node 24, locked dependencies installed with `npm ci`,
Chromium 156.0.8078.4, and Lighthouse 13.5.0.

## Website verification

| Check | Recorded result |
| --- | --- |
| `npm test -- --maxWorkers=2` | 154 tests passed across 18 files |
| `npm run lint` | No errors; existing nonblocking warnings remain |
| `npm run format:check` | Passed |
| `npm run build` | No Astro/TypeScript errors, warnings, or hints; 187 documents generated |
| `npm run check:build` | 187 documents verified at the root |
| Full Chromium Playwright suite | 69 passed; mobile-only and unconfigured-contact-form cases skipped as expected |
| WebMCP, native API, and configured contact-form tests | 25 Chromium tests passed |
| Configured contact form and accessibility | 5 mobile tests passed |
| Build and links with `SITE_URL=http://127.0.0.1:4325/xe/` | 187 documents verified |
| Native API under `/xe/` | 3 tests passed, including navigation within the active origin |
| Lighthouse Agentic browsing | 94/100; valid schemas, native discovery, and accessible tree |

The latest Lighthouse run measured CLS 0.133, which reduced the overall score.
Its previous run scored 100/100. The informational notice about newsletter forms
without declarative tool attributes is consistent with manual submission.

Native tests use Chrome's real `document.modelContext`. They exercise tool
execution, structured errors, navigation, and restoration without duplicates
through simulated `pagehide` and persisted `pageshow` events. Actual Back/Forward
navigation was tested, but Chrome reloaded the document locally, so preservation
in the Back/Forward cache was not established. Manual inspection of
**Application → WebMCP** was unavailable in the headless environment.

A temporary mutation of page-fitting logic caused pagination coverage to fail;
the original code was restored before final verification.
