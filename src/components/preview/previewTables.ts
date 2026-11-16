import { canvasHtmlToMarkdown } from "@/features/canvas/import/canvasHtmlToMarkdown";

// Tables in the preview: where a rendered table came from in the file, and the
// two ways the table menu copies one (see PreviewTableMenu).

const delimiterRow = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** The cells of a markdown table row: split on pipes that aren't escaped. */
export function tableRowCells(line: string) {
  const inner = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

// What a cell reads as, from either side: the file's markdown or the preview's
// text. Formatting characters drop out of both, so **Due** in the file
// matches Due in the preview.
const comparable = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\(.)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export interface MarkdownTableSource {
  /** offset in the source of the table's first character (after indentation) */
  start: number;
  /** the table's lines, indentation shared by all of them removed */
  text: string;
}

/**
 * The pipe table in `source` whose header reads `headers`. When more than one
 * does, the one nearest `fraction` (how far into the preview the table is).
 */
export function findMarkdownTable(
  source: string,
  headers: string[],
  fraction: number,
): MarkdownTableSource | undefined {
  const lines = source.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const wanted = headers.map(comparable);

  let best: MarkdownTableSource | undefined;
  for (let i = 0; i + 1 < lines.length; i++) {
    const header = lines[i];
    if (!header.includes("|") || !lines[i + 1].includes("|") || !delimiterRow.test(lines[i + 1]))
      continue;
    const cells = tableRowCells(header).map(comparable);
    if (cells.length !== wanted.length || cells.some((cell, c) => cell !== wanted[c])) continue;

    let end = i + 2;
    while (end < lines.length && lines[end].includes("|") && lines[end].trim()) end++;
    const tableLines = lines.slice(i, end);
    const indent = Math.min(...tableLines.map((l) => l.length - l.trimStart().length));
    const found = {
      start: lineStarts[i] + indent,
      text: tableLines.map((l) => l.slice(indent).trimEnd()).join("\n"),
    };
    if (
      !best ||
      Math.abs(found.start / source.length - fraction) <
        Math.abs(best.start / source.length - fraction)
    )
      best = found;
    i = end - 1;
  }
  return best;
}

/** The text of each header cell, the first row when the table has no <thead>. */
export function tableHeaders(table: HTMLTableElement) {
  const row = table.tHead?.rows[0] ?? table.rows[0];
  return row ? [...row.cells].map((cell) => cell.textContent ?? "") : [];
}

const alignmentOf = (cell: HTMLTableCellElement | undefined) => {
  const align = cell?.getAttribute("align") || cell?.style.textAlign;
  return align === "center" ? ":-:" : align === "right" ? "--:" : align === "left" ? ":--" : "---";
};

/**
 * A rendered table as a markdown pipe table, for a table the file didn't
 * write as one (raw HTML, a list table). Cells keep their links, code and
 * emphasis; a cell with more than one line has them joined with <br>.
 */
export function htmlTableToMarkdown(table: HTMLTableElement) {
  const rows = [...table.rows];
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((row) => row.cells.length));
  const cellMarkdown = (cell: HTMLTableCellElement | undefined) =>
    cell
      ? canvasHtmlToMarkdown(cell.innerHTML)
          .split(/\n+/)
          .join("<br>")
          .replace(/\|/g, "\\|")
      : "";
  const line = (row: HTMLTableRowElement) =>
    `| ${Array.from({ length: width }, (_, i) => cellMarkdown(row.cells[i])).join(" | ")} |`;

  const [header, ...body] = rows;
  const delimiter = `| ${Array.from({ length: width }, (_, i) => alignmentOf(header.cells[i])).join(" | ")} |`;
  return [line(header), delimiter, ...body.map(line)].join("\n");
}

/**
 * Puts `text` on the clipboard, and `html` beside it when given, so a rich
 * editor (Word, Google Docs, email) pastes the HTML and a plain one pastes
 * the text. A copy event rather than navigator.clipboard: that needs https or
 * localhost, and the app is also reached over plain http.
 */
export function copyToClipboard({ text, html }: { text: string; html?: string }) {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/plain", text);
    if (html) e.clipboardData?.setData("text/html", html);
    e.preventDefault();
  };
  document.addEventListener("copy", onCopy);
  try {
    return document.execCommand("copy");
  } finally {
    document.removeEventListener("copy", onCopy);
  }
}
