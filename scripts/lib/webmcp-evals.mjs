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
      'OLLAMA_HOST must identify an Ollama server without credentials, queries, or paths other than /v1.',
    );
  }
  return { base: url.origin, chat: `${url.origin}/v1` };
}

export function pageTools(schema, names) {
  if (names.length === 0 || new Set(names).size !== names.length) {
    throw new Error('The page catalog is empty or contains duplicates.');
  }
  return {
    tools: names.map((name) => {
      const tool = schema.tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Tool missing from catalog: ${name}`);
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
      `Model ${model} is not installed on the server. No automatic download.`,
    );
  if (digest && installed.digest !== digest) {
    throw new Error(
      `Model ${model} digest differs from expectations. Verify the weights before evaluation.`,
    );
  }
  return installed;
}

export function checkModelSupport(details, model, think) {
  if (!details.capabilities?.includes('tools'))
    throw new Error(`Model ${model} does not support tools.`);
  if (
    think === false &&
    (details.model_info?.['general.finetune'] === 'Thinking' ||
      (Array.isArray(details.thinking?.values) &&
        !details.thinking.values.includes(false)))
  ) {
    throw new Error(
      `Model ${model} requires thinking; choose an Instruct model or a compatible profile.`,
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
      'Report is missing, incomplete, or incompatible with the suite.',
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
        'Report contains unexpected cases, outcomes, or executions.',
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
    throw new Error('Inconsistent report counters.');
  }
  return { exitCode: counts.error ? 2 : counts.fail ? 1 : 0, counts };
}
