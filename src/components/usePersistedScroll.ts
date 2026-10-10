"use client";
import { useCallback, useEffect, useRef } from "react";

/**
 * Remembers a scroll container's position in localStorage under `key`.
 * `restoreDelay` waits for content that grows after mount (modules
 * re-expanding) before scrolling back to where it was.
 */
export function usePersistedScroll(key: string, restoreDelay = 0) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const restore = () => {
      let top = 0;
      try {
        top = parseInt(localStorage.getItem(key) ?? "0") || 0;
      } catch {
        // storage unavailable: start at the top
      }
      ref.current?.scroll({ top, left: 0 });
    };
    if (restoreDelay === 0) {
      restore();
      return;
    }
    const handle = setTimeout(restore, restoreDelay);
    return () => clearTimeout(handle);
  }, [key, restoreDelay]);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      try {
        localStorage.setItem(key, e.currentTarget.scrollTop.toString());
      } catch {
        // storage unavailable: nothing to remember it in
      }
    },
    [key],
  );

  return { ref, onScroll };
}
