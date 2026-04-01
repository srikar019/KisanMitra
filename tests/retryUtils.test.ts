import { describe, it, expect } from 'vitest';
import { withRetry, TTLCache } from '../services/retryUtils';

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = async () => 42;
    const result = await withRetry(fn);
    expect(result).toBe(42);
  });

  it('should retry on transient failure and eventually succeed', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error('429 Too Many Requests');
      return 'success';
    };

    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after exhausting all retry attempts', async () => {
    const fn = async () => {
      throw new Error('429 Rate limited');
    };

    await expect(
      withRetry(fn, { maxAttempts: 2, initialDelayMs: 10 }),
    ).rejects.toThrow('429 Rate limited');
  });

  it('should not retry on non-retryable errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error('Invalid input');
    };

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 }),
    ).rejects.toThrow('Invalid input');
    expect(attempts).toBe(1);
  });

  it('should retry on network errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) throw new Error('Failed to fetch');
      return 'recovered';
    };

    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('should respect custom shouldRetry function', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error('custom error');
    };

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        shouldRetry: (err) => err instanceof Error && err.message === 'custom error',
      }),
    ).rejects.toThrow('custom error');
    expect(attempts).toBe(3);
  });
});

describe('TTLCache', () => {
  it('should store and retrieve values', () => {
    const cache = new TTLCache<string, number>(60000);
    cache.set('key', 42);
    expect(cache.get('key')).toBe(42);
  });

  it('should return null for missing keys', () => {
    const cache = new TTLCache<string, number>(60000);
    expect(cache.get('missing')).toBeNull();
  });

  it('should return null for expired entries', async () => {
    const cache = new TTLCache<string, number>(50); // 50ms TTL
    cache.set('key', 42);
    expect(cache.get('key')).toBe(42);

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cache.get('key')).toBeNull();
  });

  it('should report has() correctly', () => {
    const cache = new TTLCache<string, string>(60000);
    cache.set('exists', 'value');
    expect(cache.has('exists')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('should clear all entries', () => {
    const cache = new TTLCache<string, number>(60000);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  it('should evict oldest entries when maxSize is reached', () => {
    const cache = new TTLCache<string, number>(60000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // Should evict 'a'

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });
});
