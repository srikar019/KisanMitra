/**
 * Pagination Utilities
 * Provides Firestore-compatible pagination helpers for scalable data loading.
 */

export interface PaginationState<T> {
  items: T[];
  hasMore: boolean;
  loading: boolean;
  lastDoc: unknown | null; // Firestore DocumentSnapshot
  error: string | null;
}

/**
 * Creates initial pagination state.
 */
export function createPaginationState<T>(): PaginationState<T> {
  return {
    items: [],
    hasMore: true,
    loading: false,
    lastDoc: null,
    error: null,
  };
}

/**
 * Merges new items into existing pagination state.
 * Avoids duplicates by checking an ID field.
 */
export function mergePageResults<T extends { id: string }>(
  state: PaginationState<T>,
  newItems: T[],
  lastDoc: unknown,
  pageSize: number,
): PaginationState<T> {
  const existingIds = new Set(state.items.map((item) => item.id));
  const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id));

  return {
    items: [...state.items, ...uniqueNewItems],
    hasMore: newItems.length >= pageSize,
    loading: false,
    lastDoc,
    error: null,
  };
}

/**
 * Default page sizes for different collection types.
 */
export const PAGE_SIZES = {
  PRODUCTS: 20,
  NOTIFICATIONS: 15,
  FEED_POSTS: 10,
  CHAT_MESSAGES: 30,
  LIVESTOCK: 20,
  MACHINERY: 12,
} as const;

/**
 * Formats a count with compact notation for large numbers.
 * e.g., 1500 → "1.5K", 2000000 → "2M"
 */
export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}
