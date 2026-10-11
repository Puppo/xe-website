# WebMCP implementation verification

Date: October 10, 2026. Node 24, locked dependencies installed with `npm ci`,
Chromium 156.0.8078.4, and Lighthouse 13.5.0.

## Website verification

| Check | Recorded result |
| --- | --- |
| `npm test -- --maxWorkers=2` | 173 tests passed across 20 files |
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

## Model evaluation protocol

### Evaluation review follow-up (October 11, 2026)

The earlier six-case results below predate stricter argument matching and causal
trajectory checks. Extra non-default arguments now fail and cannot obtain a
successful mock response intended for different arguments. Discovery and
continuation prerequisites are recorded with `dependsOn` and checked across model
turns; independent calls can still be batched. Deterministic regression tests
cover the former false passes and accepted controls.

Six new synthetic cases in `evals-heldout.json` run separately from development
regressions in CI. They cover unseen names/topics, multi-page continuation,
material pagination, an exhausted retry, and a non-retryable failure. The agent
instructions and model settings have not been tuned against these cases. Real
model evaluation of both suites with the strengthened assertions is pending;
fixture and simulated-provider checks do not establish model quality.

Local follow-up checks: **187 unit tests passed**, both Promptfoo configurations
validated with pinned version **0.124.1**, and lint and formatting checks passed
(lint retains nonblocking numeric-literal and other warnings). Astro check reported
zero errors, warnings, or hints, and the production build completed with 187 pages.
The real Promptfoo assertion API accepted all 12 known-good fixture conversations
and a documented-default control, and rejected five deliberate bad controls:
extra arguments, dependent batching, a wrong query, invalid schema data, and
missing prerequisite evidence. All **18 calibration controls** matched their
expected outcomes; `.evals/eval-fix-controls.json` retains the local results.

### Docker setup follow-up (October 11, 2026)

Local development and CI now share the official Ollama 0.40.2 Compose image,
pinned by its multi-platform registry digest. CPU, NVIDIA GPU, and CI cache
configurations validated offline with Docker Compose **5.6.0**. Inspection of the
merged CI configuration confirmed the loopback-only API port, health check,
persistent parent volume, and model-only cache mount. The image index supports
Linux AMD64 and ARM64. The evaluation workflow passed **actionlint 1.7.12**.

**195 unit tests passed across 22 files**, including explicit weight preparation,
default model pinning, alternate-model overrides, wrong-digest rejection, remote
host rejection, and setup failures. The preparation CLI returned setup exit **2**
when Docker was missing. Lint completed without errors (nonblocking warnings
remain), formatting passed, and the production build generated 187 pages with
zero Astro/TypeScript diagnostics. Generated-link validation passed for all
187 documents.

Docker Engine is unavailable in this environment. Container startup, GPU access,
and actual model evaluation with the new Docker setup remain pending on CI or a
capable host. No inference server was started, container image pulled, or model
weights downloaded locally. Offline configuration and mocked preparation checks
do not establish a runtime or model-quality pass.

### Historical model and protocol results

Six cases use **Promptfoo 0.124.1** with a custom native Ollama provider.
Deterministic assertions check schema, tools, order, arguments, and completion.
Unit coverage checks catalogs, fixtures, offsets, reports, conversation histories,
state isolation, HTTP errors, cancellation, and generation limits.

The real Promptfoo CLI was tested against a simulated Ollama HTTP endpoint:
six conversations and thirteen chat requests produced JSON/HTML reports and
exit **0**. Invalid schema arguments and generation-limited final responses
produced exit **1**; HTTP 503 produced exit **2** with provider errors distinct
from assertion failures. These protocol checks establish runner behavior,
not model quality.

The initial model setup exposed two compatibility issues: the default Go template
could omit assistant tool calls when content was also present, and the pinned
`qwen3:4b` tag contained Thinking 2507, which cannot disable thinking. CI uses
`OLLAMA_GO_TEMPLATE=false` and explicitly pins **Qwen3 4B Instruct 2507** instead.
Preflight rejects mandatory thinking when `think: false` is configured.

The Instruct baseline [38060174460](https://github.com/Puppo/xe-website/actions/runs/38060174460)
completed all six cases in **3 minutes 1 second**, with **3 passes, 3 assertion
failures, and no provider errors**. Profile discovery, material search, and
newsletter preparation passed. Biography continuation, catalog retry, and event
body continuation returned premature final answers without the required calls.
Transcripts retained the original user goals, assistant calls, and structured
results; the history conversion matches the native Ollama protocol. The previous
system prompt did not define how to complete paginated reads or retryable failures.

The shared agent instructions now explicitly continue requested full reads using
`nextOffset` until `null`, retry transient read failures once, and preserve manual
submission and consent. No expected call, fixture-specific tool name, slug, or
offset is inserted into the prompt. All six cases, eight homepage tools, generation
limits, and strict schema/trajectory assertions remain. Regression coverage
checks the three existing histories and rejects premature completion.
The first policy run [38084695385](https://github.com/Puppo/xe-website/actions/runs/38084695385)
completed in **3 minutes 26 seconds** with **5 passes, 1 assertion failure, and
no provider errors**. Both pagination cases passed. The retry case announced a
retry without executing a call, and the unchanged assertion rejected it. The
policy now requires the next response to execute that retry and inspect its
result before answering. The next run [38085103152](https://github.com/Puppo/xe-website/actions/runs/38085103152)
still scored 5/6: the same retry announcement consumed only 15 generated tokens,
which points to early model completion. The policy now explicitly classifies
searches as read operations and requires tool-only messages while work remains.
A diagnostic attempt [38085625868](https://github.com/Puppo/xe-website/actions/runs/38085625868)
was rejected before inference: this GGUF backend does not support `logprobs`
with tools and its internal streaming path, even with client `stream: false`.
The unsupported option was removed; no token-trace support is claimed.
Real-model behavior is checked separately in CI; protocol mocks alone do not
establish model-selection quality.

The final policy run [38085833103](https://github.com/Puppo/xe-website/actions/runs/38085833103)
passed **all six cases with no provider errors** in **2 minutes 46 seconds**.
The retry executed the original search again before answering; both pagination
cases completed. Its companion [Checks run](https://github.com/Puppo/xe-website/actions/runs/38085833093)
passed every job, including Chromium and mobile browser coverage.

The baseline [Checks run](https://github.com/Puppo/xe-website/actions/runs/38060174480)
passed every job, including Chromium and mobile browser coverage.

References: [Ollama renderer configuration](https://github.com/ollama/ollama/blob/v0.40.2/envconfig/config.go),
[legacy model template](https://ollama.com/library/qwen3:4b/blobs/ae370d884f10),
[Qwen3 Thinking/Instruct modes](https://github.com/QwenLM/Qwen3/blob/main/docs/source/getting_started/quickstart.md),
and [native tool calling](https://docs.ollama.com/capabilities/tool-calling).

No inference server was started or model weights downloaded on the local 4 GB
machine. See the [WebMCP README](README.md#evaluations-with-ollama) for execution
on suitable hardware. Generated reports remain in the ignored `.evals/` directory.
