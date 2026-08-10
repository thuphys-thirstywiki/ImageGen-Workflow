/** Strip secrets / overly verbose upstream payloads before returning to clients. */
export function publicErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  let message = error.message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");

  // OpenAI SDK often wraps JSON bodies; keep it short for the UI.
  if (message.length > 400) {
    message = `${message.slice(0, 400)}…`;
  }

  return message || fallback;
}
