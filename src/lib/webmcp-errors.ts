/** Expected failures remain visible through native WebMCP's result channel. */
export class WebMcpError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  public constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'WebMcpError';
    this.code = code;
    this.retryable = retryable;
  }
}
