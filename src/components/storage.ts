"use client";
import { useSyncExternalStore } from "react";

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

/**
 * Something shown or hidden, remembered under `key`. Until it has been
 * toggled, `openByDefault` decides (it can look at the window); the server
 * renders it `openOnServer`.
 */
export function usePersistedToggle(
  key: string,
  openByDefault: () => boolean,
  openOnServer = false,
): [boolean, () => void] {
  const open = useSyncExternalStore(
    subscribeToStorage,
    () => {
      const stored = localStorage.getItem(key);
      return stored === null ? openByDefault() : stored === "true";
    },
    () => openOnServer,
  );
  return [open, () => remember(key, String(!open))];
}
