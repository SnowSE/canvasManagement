// A tab opened before the manager was rebuilt or updated still asks for the
// old build's code files, which no longer exist, the first time it opens a
// page it hasn't loaded yet. Reloading picks up the new build. At most once a
// minute, so a file that's really missing can't reload the tab in a loop.
const KEY = "reloadedForNewBuildAt";
const MINUTE = 60_000;

export function reloadForNewBuild(
  storage: Pick<Storage, "getItem" | "setItem">,
  now: number,
  reload: () => void,
) {
  const last = Number(storage.getItem(KEY) ?? 0);
  if (now - last < MINUTE) return false;
  storage.setItem(KEY, String(now));
  reload();
  return true;
}

/** Reload when Vite can't load a code file (see above); returns the cleanup. */
export function watchForNewBuild() {
  const onPreloadError = (event: Event) => {
    try {
      if (reloadForNewBuild(sessionStorage, Date.now(), () => window.location.reload()))
        event.preventDefault();
    } catch {
      // storage unavailable: leave the error as it was
    }
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
