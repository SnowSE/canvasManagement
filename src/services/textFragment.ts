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

/** Where `text` first appears under `root`, ignoring case. */
export function findText(root: Element, text: string) {
  const wanted = text.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.textContent?.toLowerCase().indexOf(wanted) ?? -1;
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + text.length);
    return range;
  }
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
  const found = text && findText(root, text);
  if (!found) return;
  pending = undefined;
  // the text can sit deep inside one long element (a whole code block), so
  // scroll to a mark at the text itself rather than to its element
  const mark = document.createElement("span");
  found.insertNode(mark);
  mark.scrollIntoView({ block: "center" });
  mark.remove();
  root.normalize();
  const selection = getSelection();
  const shown = findText(root, text);
  if (selection && shown) {
    selection.removeAllRanges();
    selection.addRange(shown);
  }
}
