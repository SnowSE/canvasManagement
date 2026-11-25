"use client";
import { useEffect, useRef } from "react";

/**
 * Saves what is typed in an editor: `save` runs `delay` ms after the last
 * change (`changed`: what it depends on), or at once when the window loses
 * focus, before typing goes on elsewhere. A save still waiting when the
 * item is left (another item opened in this editor, or the editor closed)
 * runs then, as `save(true)`, from the item that was open: it must only
 * write, since the editor already belongs to the next item.
 */
export function useDelayedSave(itemKey: string, delay: number, save: (leaving: boolean) => void, changed: unknown[]) {
  const latest = useRef(save);
  const waiting = useRef(false);
  // set after the cleanups below have run, so on the way out they still hold the save of the item left
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => {
    const run = () => {
      waiting.current = false;
      latest.current(false);
    };
    waiting.current = true;
    const handler = setTimeout(run, delay);
    const flush = () => {
      clearTimeout(handler);
      run();
    };
    window.addEventListener("blur", flush, { once: true });
    return () => {
      clearTimeout(handler);
      window.removeEventListener("blur", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, changed);
  useEffect(
    () => () => {
      if (waiting.current) latest.current(true);
      waiting.current = false;
    },
    [itemKey],
  );
}
