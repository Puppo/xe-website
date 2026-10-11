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
      !Array.isArray(actual) &&
      Object.keys(expected).length === Object.keys(actual).length &&
      Object.entries(expected).every(([key, value]) =>
        matches(value, actual[key]),
      )
    );
  }
  return expected === actual;
}

export function matchesArguments(functionName, expected, actual) {
  if (
    !expected ||
    !actual ||
    typeof expected !== 'object' ||
    typeof actual !== 'object' ||
    Array.isArray(expected) ||
    Array.isArray(actual)
  )
    return false;
  // Only normalize defaults implemented by the website's read tools.
  const defaults = {
    ...([
      'list_events',
      'list_members',
      'search_event_materials',
      'get_event',
      'get_member',
    ].includes(functionName)
      ? { offset: 0 }
      : {}),
    ...(['get_event', 'get_member'].includes(functionName)
      ? { section: 'overview' }
      : {}),
  };
  const normalize = (args) =>
    Object.fromEntries(
      Object.entries(args).filter(
        ([key, value]) =>
          !Object.hasOwn(defaults, key) || value !== defaults[key],
      ),
    );
  return matches(normalize(expected), normalize(actual));
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
    if (!matchesArguments(entry.functionName, entry.arguments, args))
      return fail(`Step ${index + 1}: arguments differ from expectations.`);
    if (entry.dependsOn !== undefined) {
      const executed = context.providerResponse?.metadata?.toolCalls;
      const step = executed?.[index]?.step;
      if (
        !Array.isArray(entry.dependsOn) ||
        !Number.isInteger(step) ||
        step < 0 ||
        !entry.dependsOn.every(
          (dependency) =>
            Number.isInteger(dependency) &&
            dependency >= 0 &&
            dependency < index &&
            Number.isInteger(executed?.[dependency]?.step) &&
            executed[dependency].step >= 0 &&
            executed[dependency].step < step,
        )
      )
        return fail(
          `Step ${index + 1}: prerequisite results were not received before this call.`,
        );
    }
  }
  return {
    pass: true,
    score: 1,
    reason: 'Complete trajectory with correct tools, order, and arguments.',
  };
}
