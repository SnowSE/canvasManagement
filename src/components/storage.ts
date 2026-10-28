"use client";

/**
 * For useSyncExternalStore over localStorage: calls `onChange` when another
 * tab changes it, or when this tab does through `remember`.
 */
export function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** localStorage.setItem that also tells this tab's subscribers. */
export function remember(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key }));
}
