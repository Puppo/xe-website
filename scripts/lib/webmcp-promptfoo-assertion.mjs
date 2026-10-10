function matches(expected, actual) {
  if (expected && typeof expected === 'object') {
    if (Object.hasOwn(expected, '$pattern'))
      return (
        typeof actual === 'string' &&
        new RegExp(expected.$pattern, 'u').test(actual)
      );
    if (Array.isArray(expected))
      return (
        Array.isArray(actual) &&
        expected.length === actual.length &&
        expected.every((value, index) => matches(value, actual[index]))
      );
    return (
      actual !== null &&
      typeof actual === 'object' &&
      Object.entries(expected).every(([key, value]) =>
        matches(value, actual[key]),
      )
    );
  }
  return expected === actual;
}

export function assertTrajectory(output, context) {
  const fail = (reason) => ({ pass: false, score: 0, reason });
  if (context.providerResponse?.metadata?.stopReason !== 'completed')
    return fail('Conversazione non conclusa entro i limiti configurati.');
  const expected = JSON.parse(context.vars.expectedCall);
  // Le assertion function di Promptfoo ricevono gli oggetti come testo JSON.
  let calls = output;
  if (typeof output === 'string') {
    try {
      calls = JSON.parse(output);
    } catch {
      return fail('Risposta non serializzata come JSON valido.');
    }
  }
  if (!Array.isArray(calls) || calls.length !== expected.length)
    return fail('Numero di chiamate diverso dalla traiettoria prevista.');
  for (const [index, call] of calls.entries()) {
    const entry = expected[index];
    if (call.function?.name !== entry.functionName)
      return fail(`Passo ${index + 1}: strumento o ordine errato.`);
    let args;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      return fail(`Passo ${index + 1}: argomenti JSON non validi.`);
    }
    if (!matches(entry.arguments, args))
      return fail(`Passo ${index + 1}: argomenti diversi da quelli attesi.`);
  }
  return {
    pass: true,
    score: 1,
    reason: 'Traiettoria completa con strumenti, ordine e argomenti corretti.',
  };
}
