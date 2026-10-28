"use client";
import { useCallback } from "react";

/**
 * A ref for a scroll container that remembers its position in localStorage
 * under `key`. `restoreDelay` waits for content that grows after mount
 * (modules re-expanding) before scrolling back to where it was.
 */
export function usePersistedScroll(key: string, restoreDelay = 0) {
  return useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const restore = () => {
        let top = 0;
        try {
          top = parseInt(localStorage.getItem(key) ?? "0") || 0;
        } catch {
          // storage unavailable: start at the top
        }
        element.scroll({ top, left: 0 });
      };
      const save = () => {
        try {
          localStorage.setItem(key, element.scrollTop.toString());
        } catch {
          // storage unavailable: nothing to remember it in
        }
      };
      element.addEventListener("scroll", save);
      if (restoreDelay === 0) restore();
      const handle = restoreDelay === 0 ? undefined : setTimeout(restore, restoreDelay);
      return () => {
        clearTimeout(handle);
        element.removeEventListener("scroll", save);
      };
    },
    [key, restoreDelay],
  );
}
