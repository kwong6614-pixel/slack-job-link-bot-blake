function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: number; status?: number; message?: string };
  return (
    err.code === 429 ||
    err.status === 429 ||
    (err.message?.includes("Quota exceeded") ?? false)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withSheetsRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      const delayMs = Math.min(2000 * 2 ** attempt, 32000);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
