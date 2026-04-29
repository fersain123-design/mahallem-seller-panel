import type { TrAddressData } from './types';

let cache: Promise<TrAddressData> | null = null;

export function loadTrAddressData(): Promise<TrAddressData> {
  if (!cache) {
    cache = fetch('/data/tr-address.min.json', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load address dataset: ${res.status}`);
        return (await res.json()) as TrAddressData;
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}
