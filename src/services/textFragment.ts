// A link like page#:~:text=%C2%A74.4 asks the browser to scroll to that text.
// The browser looks as soon as the page loads, before the preview has
// rendered, so the preview looks again once it has.

/** The text a #:~:text=[prefix-,]start[,end][,-suffix] link points at. */
export function textFragmentOf(url: string) {
  const directive = /:~:text=([^&]+)/.exec(url)?.[1];
  const start = directive
    ?.split(",")
    .find((part) => !part.endsWith("-") && !part.startsWith("-"));
  return start && decodeURIComponent(start);
}

/** The innermost element under `root` whose own text contains `text`. */
export function findText(root: Element, text: string) {
  const wanted = text.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    if (node.textContent?.toLowerCase().includes(wanted)) return node.parentElement ?? undefined;
  return undefined;
}

// Scripts can't see the directive in location.href; the page load's
// navigation entry keeps it. Used once, by the first preview of that page.
let pending =
  typeof performance === "undefined"
    ? undefined
    : (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
        ?.name;

/** Scrolls `root` to the text the page was opened with, once per page load. */
export function scrollToOpeningTextFragment(root: Element) {
  if (!pending || new URL(pending).pathname !== location.pathname) return;
  const text = textFragmentOf(pending);
  const target = text && findText(root, text);
  if (!target) return;
  pending = undefined;
  target.scrollIntoView({ block: "start" });
}
