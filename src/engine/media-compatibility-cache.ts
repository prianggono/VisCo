export interface MediaCacheEntry {
  readonly sourceUri: string;
  readonly cachedUri: string;
  readonly playable: boolean;
  readonly createdAt: string;
}

export interface MediaCompatibilityCache {
  get(sourceUri: string): Promise<MediaCacheEntry | null>;
  put(entry: MediaCacheEntry): Promise<void>;
  remove(sourceUri: string): Promise<void>;
}

/** Runtime policy: compatibility conversion is cacheable and never blocks the native path. */
export async function resolveMediaCompatibility(
  sourceUri: string,
  nativePlayable: boolean,
  cache: MediaCompatibilityCache
): Promise<MediaCacheEntry> {
  if (!sourceUri.trim()) throw new Error("Media URI is required.");
  if (nativePlayable) return { sourceUri, cachedUri: sourceUri, playable: true, createdAt: new Date().toISOString() };
  const cached = await cache.get(sourceUri);
  if (cached?.playable) return cached;
  const entry = {
    sourceUri,
    cachedUri: `compatibility-cache://${encodeURIComponent(sourceUri)}`,
    playable: true,
    createdAt: new Date().toISOString()
  };
  await cache.put(entry);
  return entry;
}
