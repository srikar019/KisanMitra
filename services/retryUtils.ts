/**
 * Retry Utilities
 * Provides exponential backoff retry logic for API calls and a TTL-based cache.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxAttempts?: number;
  /** Initial delay in milliseconds. Default: 1000 */
  initialDelayMs?: number;
  /** Maximum delay between retries. Default: 10000 */
  maxDelayMs?: number;
  /** Whether to add random jitter to delay. Default: true */
  jitter?: boolean;
  /** Which error types to retry on. Default: retries on rate-limit and network errors. */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Default retry condition: retry on rate-limit (429), network errors, and server errors.
 */
const defaultShouldRetry = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('500') ||
      msg.includes('503')
    );
  }
  return false;
};

/**
 * Executes an async function with exponential backoff retry logic.
 *
 * @example
 * const data = await withRetry(() => fetchFromAPI(params), { maxAttempts: 3 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    jitter = true,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

      // Add jitter (±25%) to prevent thundering herd
      if (jitter) {
        const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
        delay = Math.floor(delay * jitterFactor);
      }

      console.warn(
        `Retry attempt ${attempt}/${maxAttempts} after ${delay}ms. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * A Map-based cache with Time-To-Live (TTL) support.
 * Entries automatically expire after the TTL period.
 *
 * @example
 * const cache = new TTLCache<string, WeatherData>(5 * 60 * 1000); // 5 minute TTL
 * cache.set('key', data);
 * const cached = cache.get('key'); // null if expired
 */
export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number, maxSize: number = 100) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  has(key: K): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
