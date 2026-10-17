import type { editor } from "monaco-editor";

// Clicking text in the preview moves the editor to it: plain text in the
// preview is, almost always, written the same way in the file.

/**
 * The text around `offset` in a text node (all of it if short, else nearby
 * whole words), and where in the node it starts.
 */
export function snippetAt(text: string, offset: number) {
  const short = text.length <= 40;
  const start = short ? 0 : text.lastIndexOf(" ", Math.max(0, offset - 20)) + 1;
  const after = short ? -1 : text.indexOf(" ", Math.min(text.length, offset + 20));
  return { text: text.slice(start, after < 0 ? text.length : after), start };
}

/**
 * Where `snippet` is in `source`. When it appears more than once, the match
 * nearest `fraction` (how far into the preview's text the click was, 0 to 1).
 */
export function sourceOffsetOf(source: string, snippet: string, fraction: number) {
  let best: number | undefined;
  for (let at = source.indexOf(snippet); at >= 0; at = source.indexOf(snippet, at + 1))
    if (best === undefined || Math.abs(at / source.length - fraction) < Math.abs(best / source.length - fraction))
      best = at;
  return best;
}

// the editor on screen; there is only ever one
let current: editor.IStandaloneCodeEditor | undefined;
/** Makes `ed` the editor that preview clicks move, until it is disposed. */
export const followPreviewClicks = (ed: editor.IStandaloneCodeEditor) => {
  current = ed;
  ed.onDidDispose(() => {
    if (current === ed) current = undefined;
  });
};

/** Moves the editor to the text clicked in `preview`, if it can find it. */
export function jumpToClickedText(preview: Element, event: MouseEvent) {
  const model = current?.getModel();
  const clicked = (event.target as Element).closest("a, button, summary, input, label");
  if (!current || !model || clicked || !getSelection()?.isCollapsed) return;
  const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = caret ? undefined : document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = caret?.offsetNode ?? range?.startContainer;
  const offset = caret?.offset ?? range?.startOffset ?? 0;
  if (!node || node.nodeType !== Node.TEXT_NODE || !preview.contains(node)) return;

  const snippet = snippetAt(node.textContent ?? "", offset);
  if (!snippet.text.trim()) return;
  // how much of the preview's text comes before the click
  const before = document.createRange();
  before.setStart(preview, 0);
  before.setEnd(node, offset);
  const fraction = before.toString().length / Math.max(1, preview.textContent?.length ?? 0);
  const at = sourceOffsetOf(model.getValue(), snippet.text, fraction);
  if (at === undefined) return;
  const position = model.getPositionAt(at + offset - snippet.start);
  current.setPosition(position);
  current.revealPositionInCenter(position);
  current.focus();
}
