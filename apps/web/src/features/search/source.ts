import type { PlaySource } from '@/stores/player.store';

/** Search results are not a collection, so the queue has no id. */
export const SEARCH_SOURCE: PlaySource = { context: 'search', id: null };
