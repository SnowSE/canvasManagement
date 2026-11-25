import { diffArrays } from "diff";
import { marked } from "marked";
import { htmlIsCloseEnough, removeHtmlDetails } from "@/services/utils/htmlIsCloseEnough";

/** The page's own blocks in `html` (a heading, a paragraph, a list…), each as HTML; a theme's stylesheet and script aren't the page's. */
const blocksOf = (html: string) =>
  [...new DOMParser().parseFromString(html, "text/html").body.children].filter((el) => !["LINK", "SCRIPT", "STYLE"].includes(el.tagName)).map((el) => el.outerHTML);

/**
 * Pull from Canvas for a description: `markdown` with only the blocks that
 * differ from `canvasHtml` replaced, by Canvas's own HTML for them (which
 * markdown takes as it is), so every other block stays as the file wrote
 * it: a diagram its source, a link its path. `render` is how the compare
 * page renders the file. The result always reads as Canvas does: where
 * lining the blocks up can't get there, the whole description is Canvas's
 * HTML, and undefined when even that doesn't match (nothing should be
 * written then).
 */
export function pullDescription(markdown: string, canvasHtml: string, render: (markdown: string) => string): string | undefined {
  if (htmlIsCloseEnough(render(markdown), canvasHtml)) return markdown;
  const tokens = marked.lexer(markdown).map((token) => ({ raw: token.raw, space: token.type === "space", blocks: token.type === "space" ? [] : blocksOf(render(token.raw)) }));
  // a block of the file's that shows nothing on the page (a hidden one) has nothing in Canvas to differ from: always kept
  const unseen = (i: number) => !tokens[i].space && tokens[i].blocks.length === 0;
  const canvas = blocksOf(canvasHtml);
  const owner = tokens.flatMap((token, i) => token.blocks.map(() => i));
  const key = (block: string) => removeHtmlDetails(block);
  const changes = diffArrays(tokens.flatMap((t) => t.blocks).map(key), canvas.map(key));

  // a block of the file's is kept when Canvas has every block it renders to
  const matched = new Array<boolean>(owner.length).fill(false);
  let at = 0;
  for (const change of changes) {
    if (!change.added && !change.removed) matched.fill(true, at, at + change.count!);
    if (!change.added) at += change.count!;
  }
  const kept = tokens.map((_, i) => owner.every((o, j) => o !== i || matched[j]));

  let out = "";
  const apart = () => (out = out && out.replace(/\n*$/, "\n\n"));
  let next = 0; // the first of the file's blocks not yet written or dropped
  const writeUpTo = (i: number) => {
    for (; next < i; next++) if (unseen(next)) out = apart() + tokens[next].raw;
  };
  const writeKept = (i: number) => {
    if (i < next) return;
    writeUpTo(i);
    out = apart() + tokens[i].raw;
    for (next = i + 1; next < tokens.length && tokens[next].space; next++) out += tokens[next].raw;
  };
  let local = 0, theirs = 0;
  for (const change of changes)
    for (let n = 0; n < change.count!; n++) {
      const mine = change.added ? undefined : owner[local++];
      if (change.removed) continue;
      // Canvas's block: the file's own source for it when that is kept, else Canvas's HTML
      if (mine !== undefined && kept[mine]) writeKept(mine);
      else out = apart() + canvas[theirs] + "\n";
      theirs++;
    }
  writeUpTo(tokens.length);

  if (htmlIsCloseEnough(render(out), canvasHtml)) return out;
  const whole = [...tokens.filter((_, i) => unseen(i)).map((t) => t.raw.trim()), ...canvas].join("\n\n") + "\n";
  return htmlIsCloseEnough(render(whole), canvasHtml) ? whole : undefined;
}
