// Every tab screen lives under a single expo-router <Slot/> (see
// (main)/_layout.tsx), which fully unmounts a screen the moment you
// navigate away from it - there is no persistent tab navigator keeping
// them alive in the background. That means every tab switch was
// re-mounting the screen from scratch, resetting `loading` to true and
// flashing the full-screen spinner even when the data hadn't changed.
//
// This is a tiny stale-while-revalidate cache: a screen seeds its state
// from here on mount (so a revisit renders the last-known data instantly,
// no spinner) and still kicks off a normal background refetch via its
// existing useFocusEffect, updating the cache + UI quietly once it lands.
// Cleared automatically on logout via clearScreenCache() so the next
// user's session never sees a previous user's cached data.
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearScreenCache(): void {
  cache.clear();
}
