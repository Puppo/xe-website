export function ollamaEndpoints(host) {
  const url = new URL(host);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['/', '/v1', '/v1/'].includes(url.pathname)
  ) {
    throw new Error(
      'OLLAMA_HOST deve indicare un server Ollama senza credenziali, query o percorsi diversi da /v1.',
    );
  }
  return { base: url.origin, chat: `${url.origin}/v1` };
}

export function pageTools(schema, names) {
  if (names.length === 0 || new Set(names).size !== names.length) {
    throw new Error('Il catalogo della pagina è vuoto o contiene duplicati.');
  }
  return {
    tools: names.map((name) => {
      const tool = schema.tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Strumento assente dal catalogo: ${name}`);
      return tool;
    }),
  };
}

export function installedModel(tags, model, digest) {
  const installed = tags.models?.find(
    (entry) => entry.name === model || entry.model === model,
  );
  if (!installed)
    throw new Error(
      `Modello ${model} non presente sul server. Nessun download automatico.`,
    );
  if (digest && installed.digest !== digest) {
    throw new Error(
      `Digest del modello ${model} diverso da quello previsto. Verifica i pesi prima della valutazione.`,
    );
  }
  return installed;
}

export function checkModelSupport(details, model, think) {
  if (!details.capabilities?.includes('tools'))
    throw new Error(`Il modello ${model} non supporta gli strumenti.`);
  if (
    think === false &&
    (details.model_info?.['general.finetune'] === 'Thinking' ||
      (Array.isArray(details.thinking?.values) &&
        !details.thinking.values.includes(false)))
  ) {
    throw new Error(
      `Il modello ${model} richiede thinking; scegli un modello Instruct o un profilo compatibile.`,
    );
  }
}

export function checkEvaluationReport(report, cases) {
  const summary = report?.results;
  if (
    cases.length === 0 ||
    summary?.version !== 3 ||
    !Array.isArray(summary.results) ||
    summary.results.length !== cases.length
  ) {
    throw new Error(
      'Rapporto mancante, incompleto o incompatibile con la suite.',
    );
  }
  const seen = new Set();
  const counts = { pass: 0, fail: 0, error: 0 };
  for (const result of summary.results) {
    const { testIdx, promptIdx, success, failureReason } = result;
    if (
      !Number.isInteger(testIdx) ||
      !cases[testIdx] ||
      seen.has(testIdx) ||
      promptIdx !== 0 ||
      result.testCase?.description !== cases[testIdx].name ||
      ![0, 1, 2].includes(failureReason) ||
      success !== (failureReason === 0)
    ) {
      throw new Error(
        'Il rapporto contiene casi, esiti o esecuzioni non previsti.',
      );
    }
    seen.add(testIdx);
    counts[
      failureReason === 0 ? 'pass' : failureReason === 1 ? 'fail' : 'error'
    ]++;
  }
  if (
    summary.stats?.successes !== counts.pass ||
    summary.stats?.failures !== counts.fail ||
    summary.stats?.errors !== counts.error
  ) {
    throw new Error('Contatori del rapporto incoerenti.');
  }
  return { exitCode: counts.error ? 2 : counts.fail ? 1 : 0, counts };
}
