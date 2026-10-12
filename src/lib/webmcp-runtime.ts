import { WebMcpError } from './webmcp-errors';
import { checkedOutput, outputFits, truncate } from './webmcp-pagination';

const jsonCache = new Map<string, unknown>();

/** Cache successful data only. Each pending fetch owns its execution signal. */
export async function fetchWebMcpJson<T>(
  url: string,
  isExpected: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  let value = jsonCache.get(url);
  if (!jsonCache.has(url)) {
    let response: Response;
    try {
      response = await fetch(url, { signal });
    } catch {
      signal?.throwIfAborted();
      throw new WebMcpError(
        'NETWORK_ERROR',
        'I dati WebMCP non sono disponibili. Controlla la connessione e riprova.',
        true,
      );
    }
    signal?.throwIfAborted();
    if (!response.ok) {
      throw new WebMcpError(
        'DATA_UNAVAILABLE',
        'I dati WebMCP non sono disponibili. Riprova più tardi.',
        response.status >= 500 || response.status === 429,
      );
    }
    try {
      value = await response.json();
    } catch {
      signal?.throwIfAborted();
      throw new WebMcpError(
        'INVALID_DATA',
        'I dati WebMCP non sono validi. Ricarica la pagina e riprova.',
      );
    }
  }
  signal?.throwIfAborted();
  if (!isExpected(value)) {
    throw new WebMcpError(
      'INVALID_DATA',
      'I dati WebMCP non sono validi. Ricarica la pagina e riprova.',
    );
  }
  jsonCache.set(url, value);
  return value;
}

function safeTool(tool: WebMCP.ModelContextTool): WebMCP.ModelContextTool {
  return {
    ...tool,
    async execute(input, options) {
      try {
        options.signal.throwIfAborted();
        const result = await tool.execute(input, options);
        options.signal.throwIfAborted();
        return checkedOutput(result);
      } catch (error) {
        options.signal.throwIfAborted();
        const failure = {
          error:
            error instanceof WebMcpError || error instanceof TypeError
              ? truncate(error.message, 400)
              : 'Lo strumento non ha completato l’operazione. Ricarica la pagina e riprova.',
          code:
            error instanceof WebMcpError
              ? error.code
              : error instanceof TypeError
                ? 'INVALID_INPUT'
                : 'EXECUTION_FAILED',
          retryable: error instanceof WebMcpError && error.retryable,
        };
        return outputFits(failure)
          ? failure
          : {
              error:
                'Il dettaglio dell’errore supera il limite. Ricarica la pagina e riprova.',
              code: 'EXECUTION_FAILED',
              retryable: false,
            };
      }
    },
  };
}

export function registerWebMcpTools(tools: WebMCP.ModelContextTool[]): void {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const registerTool = context.registerTool.bind(context);
  let controller: AbortController | undefined;
  function register() {
    if (controller && !controller.signal.aborted) return;
    controller = new AbortController();
    const { signal } = controller;
    for (const tool of tools) {
      void registerTool(safeTool(tool), { signal }).catch((error: unknown) => {
        if (signal.aborted) return;
        // Report metadata only: arguments and form values may contain personal data.
        // oxlint-disable-next-line no-console -- Registration failures must be diagnosable.
        console.warn(
          '[WebMCP]',
          tool.name,
          error instanceof Error ? error.name : 'RegistrationError',
        );
      });
    }
  }
  register();
  window.addEventListener('pagehide', () => controller?.abort());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) register();
  });
}

export function fillControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

export function requiredString(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Il parametro “${key}” è obbligatorio.`);
  }
  return value.trim();
}

function editableControls(form: HTMLFormElement) {
  return [
    ...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea',
    ),
  ].filter((control) => !control.closest('.honeypot'));
}

function isDirty(control: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (
    control instanceof HTMLInputElement &&
    ['checkbox', 'radio'].includes(control.type)
  ) {
    return control.checked !== control.defaultChecked;
  }
  return control.value !== control.defaultValue;
}

export function assertNoUnsavedForms(): void {
  if (
    [...document.forms].some((form) => editableControls(form).some(isDirty))
  ) {
    throw new WebMcpError(
      'UNSAVED_CHANGES',
      'Un modulo contiene modifiche non inviate. Completa o svuota il modulo prima di aprire un’altra pagina.',
    );
  }
}

/** Validate cloned controls first: a failed preparation must leave the draft intact. */
export async function prepareForm(
  form: HTMLFormElement,
  fields: { control: HTMLInputElement | HTMLTextAreaElement; value: string }[],
  focus: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  for (const { control, value } of fields) {
    const clone = control.cloneNode() as HTMLInputElement | HTMLTextAreaElement;
    clone.value = value;
    if (
      (control.maxLength >= 0 && value.length > control.maxLength) ||
      !clone.checkValidity()
    ) {
      throw new TypeError(
        `Il campo “${control.name}” non è valido. Correggilo e riprova.`,
      );
    }
    if (isDirty(control) && control.value !== value) {
      throw new WebMcpError(
        'DRAFT_CONFLICT',
        'Il modulo contiene una bozza diversa. Rivedi o svuota i campi prima di prepararne un’altra.',
      );
    }
  }
  signal.throwIfAborted();
  for (const { control, value } of fields) fillControl(control, value);
  form.scrollIntoView({ block: 'center' });
  focus.focus();
  // Yield after synchronous input/change handlers and focus have updated the DOM.
  await Promise.resolve();
}
