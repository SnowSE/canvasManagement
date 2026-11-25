import { withoutNoise } from "./htmlNoise";
import { diffArrays, diffLines, diffWordsWithSpace } from "diff";

/**
 * Text-level comparison of two HTML fragments, used by the compare page to
 * show how the file's rendered markdown differs from the Canvas description.
 *
 * Direction: `canvasHtml` is what Canvas has now (the "old" side) and
 * `localHtml` is what publishing would put there (the "new" side), so `added`
 * means "in the file" and `removed` means "only in Canvas".
 */

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface TextDiffLine {
  /** "same" lines match on both sides; "changed" lines carry word-level parts. */
  kind: "same" | "changed";
  parts: DiffPart[];
}

const blockTagRegex =
  /<\/?(p|div|li|h[1-6]|tr|pre|blockquote|ul|ol|table|thead|tbody|section|article|header|footer|figure|figcaption|dd|dt|dl)\b[^>]*>|<(br|hr)\s*\/?>/gi;
const tagRegex = /<[^>]+>/g;

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith("#x")) {
        const code = parseInt(lower.slice(2), 16);
        return Number.isNaN(code) ? match : String.fromCodePoint(code);
      }
      if (lower.startsWith("#")) {
        const code = parseInt(lower.slice(1), 10);
        return Number.isNaN(code) ? match : String.fromCodePoint(code);
      }
      return namedEntities[lower] ?? match;
    },
  );
}

/** Visible text of an HTML fragment, one line per block element, blank lines dropped. */
export function htmlToTextLines(html: string): string[] {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(blockTagRegex, "\n")
    .replace(tagRegex, "");
  return decodeHtmlEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

/**
 * Lines of visible text, aligned across both sides. Runs of removed and added
 * lines are paired up so a reworded paragraph shows word-level changes rather
 * than a whole-paragraph replacement.
 */
export function diffHtmlText(
  localHtml: string,
  canvasHtml: string,
): TextDiffLine[] {
  return diffTextLines(htmlToTextLines(canvasHtml), htmlToTextLines(localHtml));
}

/** Lines of text aligned (see diffHtmlText): `oldLines` is Canvas's side, `newLines` the file's. */
function diffTextLines(oldLines: string[], newLines: string[]): TextDiffLine[] {
  const changes = diffArrays(oldLines, newLines);
  const result: TextDiffLine[] = [];

  let pendingRemoved: string[] = [];
  const flush = (added: string[]) => {
    const pairs = Math.min(pendingRemoved.length, added.length);
    for (let i = 0; i < pairs; i++) {
      result.push({
        kind: "changed",
        parts: diffWordsWithSpace(pendingRemoved[i], added[i]).map((p) => ({
          value: p.value,
          added: p.added || undefined,
          removed: p.removed || undefined,
        })),
      });
    }
    for (const line of pendingRemoved.slice(pairs))
      result.push({ kind: "changed", parts: [{ value: line, removed: true }] });
    for (const line of added.slice(pairs))
      result.push({ kind: "changed", parts: [{ value: line, added: true }] });
    pendingRemoved = [];
  };

  for (const change of changes) {
    if (change.removed) {
      pendingRemoved.push(...change.value);
    } else if (change.added) {
      flush(change.value);
    } else {
      flush([]);
      for (const line of change.value)
        result.push({ kind: "same", parts: [{ value: line }] });
    }
  }
  flush([]);
  return result;
}

/**
 * Collapses long runs of unchanged lines, keeping `context` lines on either
 * side of each change. A collapsed run becomes `{ skipped: n }`.
 */
export type CollapsedDiffLine = TextDiffLine | { skipped: number };

export function collapseUnchanged(
  lines: TextDiffLine[],
  context = 1,
): CollapsedDiffLine[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (line.kind !== "changed") return;
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++)
      keep[j] = true;
  });
  const result: CollapsedDiffLine[] = [];
  let skipped = 0;
  lines.forEach((line, i) => {
    if (keep[i]) {
      if (skipped > 0) result.push({ skipped });
      skipped = 0;
      result.push(line);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) result.push({ skipped });
  return result;
}

/**
 * HTML with the noise the sync check ignores stripped out (see withoutNoise,
 * and whitespace between tags), one tag boundary per line so a line diff
 * points at the element that differs.
 */
export function normalizeHtmlForDiff(html: string): string {
  return withoutNoise(html)
    .replace(/\\"/g, '"')
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/></g, ">\n<")
    .trim();
}

export interface HtmlDiffLine {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/** Line diff of the two sides after `normalizeHtmlForDiff`. */
export function diffNormalizedHtml(
  localHtml: string,
  canvasHtml: string,
): HtmlDiffLine[] {
  const oldText = normalizeHtmlForDiff(canvasHtml);
  const newText = normalizeHtmlForDiff(localHtml);
  return diffLines(oldText + "\n", newText + "\n").flatMap((change) =>
    change.value
      .split("\n")
      .filter((line, i, all) => !(i === all.length - 1 && line === ""))
      .map((line) => ({
        value: line,
        added: change.added || undefined,
        removed: change.removed || undefined,
      })),
  );
}

/**
 * The two sides of a value that differs (a question, as the compare page
 * shows it), each as parts: `added` marks what only the file has, `removed`
 * what only Canvas has. The lines are aligned and a changed line is marked
 * word by word, so a one-word edit reads as one word.
 */
export function diffSides(local: string, canvas: string): { local: DiffPart[]; canvas: DiffPart[] } {
  const lines = diffTextLines(canvas.split("\n"), local.split("\n"));
  // a side shows the lines it has: not the other side's own parts
  const side = (others: "added" | "removed") =>
    lines
      .map((line) => line.parts.filter((part) => !part[others]))
      .filter((parts) => parts.length > 0)
      .flatMap((parts, i) => (i === 0 ? parts : [{ value: "\n" }, ...parts]));
  return { local: side("removed"), canvas: side("added") };
}
