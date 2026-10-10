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
    return fail('Conversation did not finish within the configured limits.');
  const expected = JSON.parse(context.vars.expectedCall);
  // Promptfoo function assertions receive objects as JSON text.
  let calls = output;
  if (typeof output === 'string') {
    try {
      calls = JSON.parse(output);
    } catch {
      return fail('Response is not serialized as valid JSON.');
    }
  }
  if (!Array.isArray(calls) || calls.length !== expected.length)
    return fail('Call count differs from the expected trajectory.');
  for (const [index, call] of calls.entries()) {
    const entry = expected[index];
    if (call.function?.name !== entry.functionName)
      return fail(`Step ${index + 1}: incorrect tool or order.`);
    let args;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      return fail(`Step ${index + 1}: invalid JSON arguments.`);
    }
    if (!matches(entry.arguments, args))
      return fail(`Step ${index + 1}: arguments differ from expectations.`);
  }
  return {
    pass: true,
    score: 1,
    reason: 'Complete trajectory with correct tools, order, and arguments.',
  };
}
