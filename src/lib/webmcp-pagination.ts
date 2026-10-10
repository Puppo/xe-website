import { WebMcpError } from './webmcp-errors';

export const WEBMCP_OUTPUT_CHARACTER_LIMIT = 1500;
const MAX_PAGE_SIZE = 5;

export function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

export function validateOffset(offset: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new TypeError(
      'L’offset deve essere un intero maggiore o uguale a zero.',
    );
  }
}

export function outputFits(
  value: unknown,
  maximum = WEBMCP_OUTPUT_CHARACTER_LIMIT,
): boolean {
  const serialized = JSON.stringify(value);
  return serialized !== undefined && serialized.length <= maximum;
}

export function checkedOutput<T>(value: T): T {
  if (!outputFits(value)) {
    throw new WebMcpError(
      'OUTPUT_TOO_LARGE',
      'La dimensione della risposta supera il limite. Scegli una sezione più specifica o consulta la pagina originale.',
    );
  }
  return value;
}

/** Pack complete items; advance by the items actually returned, never by five. */
export function paginateItems<T, R>(
  items: readonly T[],
  offset: number,
  makePage: (items: T[], nextOffset: number | null) => R,
): R {
  validateOffset(offset);
  const pageItems: T[] = [];
  const next = (count: number) =>
    offset + count < items.length ? offset + count : null;
  for (const item of items.slice(offset, offset + MAX_PAGE_SIZE)) {
    if (
      !outputFits(makePage([...pageItems, item], next(pageItems.length + 1)))
    ) {
      if (pageItems.length === 0) {
        throw new WebMcpError(
          'OUTPUT_TOO_LARGE',
          'Un elemento non entra nella pagina. Consulta la pagina originale per questo elemento.',
        );
      }
      break;
    }
    pageItems.push(item);
  }
  return checkedOutput(makePage(pageItems, next(pageItems.length)));
}

/** Count JSON escaping and metadata, and never cut a surrogate pair in half. */
export function paginateText(
  text: string,
  offset: number,
  context: Record<string, unknown>,
) {
  validateOffset(offset);
  const makePage = (length: number) => ({
    ...context,
    text: text.slice(offset, offset + length),
    offset,
    total: text.length,
    nextOffset: offset + length < text.length ? offset + length : null,
  });
  let low = 0;
  let high = Math.max(0, text.length - offset);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (outputFits(makePage(middle))) low = middle;
    else high = middle - 1;
  }
  if (low > 0 && /[\uD800-\uDBFF]/u.test(text.charAt(offset + low - 1)))
    low -= 1;
  if (low === 0 && offset < text.length) {
    throw new WebMcpError(
      'OUTPUT_TOO_LARGE',
      'La dimensione dei metadati supera il limite. Consulta la pagina originale.',
    );
  }
  return checkedOutput(makePage(low));
}

/** Keep mandatory lines intact; omit complete optional lines with an explicit notice. */
export function describeWithinBudget(
  lines: string[],
  optionalLines: string[],
  ending: string,
  maximum: number,
): string {
  let result = lines.join('\n');
  if (!outputFits(result, maximum)) {
    throw new WebMcpError(
      'OUTPUT_TOO_LARGE',
      'La descrizione supera il limite. Consulta la pagina originale.',
    );
  }
  let omitted = 0;
  const notice = `\n… ${optionalLines.length} dettagli omessi; ${ending}`;
  for (const line of optionalLines) {
    if (outputFits(`${result}\n${line}${notice}`, maximum))
      result += `\n${line}`;
    else omitted += 1;
  }
  if (omitted > 0) result += `\n… ${omitted} dettagli omessi; ${ending}`;
  if (!outputFits(result, maximum)) {
    throw new WebMcpError(
      'OUTPUT_TOO_LARGE',
      'La descrizione supera il limite. Consulta la pagina originale.',
    );
  }
  return result;
}
