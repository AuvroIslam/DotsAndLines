/**
 * Normalise an unknown thrown value into a small, loggable shape. Firebase
 * errors carry a `code` (`permission-denied`, `unavailable`, …) worth keeping;
 * everything else falls back to a message. Shared by the repositories so their
 * listener error handlers all log the same way.
 */
export function describeError(e: unknown): { code?: string; message: string } {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message ?? String(e) };
}
