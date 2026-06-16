const cache = new Map<string, { data: unknown; timestamp: number }>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 5 * 60 * 1000;

export function clearVersionCache(): void {
  cache.clear();
  inflight.clear();
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}
