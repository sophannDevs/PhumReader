/**
 * One-time move of saved data to the V2.1 prefix `phumireader.` (design/spec.md §0 "Brand").
 * Keys saved under the old prefixes `phumreader.` (V1) and `toonwave.` (the prototype) are copied to the new prefix
 * when the new key does not exist yet, then removed, so it runs only once per browser. `phumreader.` wins over
 * `toonwave.`.
 *
 * StoreHydrator calls it before the store rehydrates and before the theme provider reads its key (child effects run
 * before parent effects).
 */
export const STORAGE_PREFIX = "phumireader."
const OLD_PREFIXES = ["phumreader.", "toonwave."] as const

export function migrateStorage(storage: Storage = window.localStorage) {
  try {
    const found: [number, string][] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      const p = key ? OLD_PREFIXES.findIndex((prefix) => key.startsWith(prefix)) : -1
      if (key && p >= 0) found.push([p, key])
    }
    found.sort((a, b) => a[0] - b[0])
    for (const [p, key] of found) {
      const next = STORAGE_PREFIX + key.slice(OLD_PREFIXES[p].length)
      const value = storage.getItem(key)
      if (storage.getItem(next) === null && value !== null) storage.setItem(next, value)
      storage.removeItem(key)
    }
  } catch {
    // Storage blocked (private mode): nothing to move.
  }
}
