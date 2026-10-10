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

export function checkEvaluationReport(report, cases) {
  const summary = report?.results;
  if (
    cases.length === 0 ||
    summary?.testCount !== cases.length ||
    !Array.isArray(summary.results)
  ) {
    throw new Error(
      'Rapporto mancante, incompleto o incompatibile con la suite.',
    );
  }
  const groups = new Map(cases.map((test) => [test.name, []]));
  const counts = { pass: 0, fail: 0, error: 0 };
  for (const result of summary.results) {
    const group = groups.get(result.test?.name);
    if (
      !group ||
      result.runIndex !== 1 ||
      !Object.hasOwn(counts, result.outcome)
    ) {
      throw new Error(
        'Il rapporto contiene casi, esiti o esecuzioni non previsti.',
      );
    }
    group.push(result);
    counts[result.outcome]++;
  }
  for (const [outcome, count] of Object.entries(counts)) {
    if (summary[`${outcome}Count`] !== count)
      throw new Error('Contatori del rapporto incoerenti.');
  }
  for (const test of cases) {
    const rows = groups.get(test.name);
    if (
      rows.length === 0 ||
      rows.some((entry, index) => entry.stepIndex !== index + 1)
    ) {
      throw new Error(`Caso incompleto o passi duplicati: ${test.name}`);
    }
    if (
      rows.every((entry) => entry.outcome === 'pass') &&
      rows.length !== test.expectedCall.length
    ) {
      throw new Error(`Traiettoria incompleta: ${test.name}`);
    }
  }
  return {
    exitCode: counts.error ? 2 : counts.fail ? 1 : 0,
    counts,
  };
}
