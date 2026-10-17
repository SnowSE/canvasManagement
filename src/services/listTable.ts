import type {
  RendererThis,
  Token,
  Tokenizer,
  TokenizerThis,
  Tokens,
} from "marked";

// A list after <!-- table caption="…" --> renders as a table that fits any
// width with inline styles alone (Canvas strips <style> and scripts):
//
//   <!-- table caption="Schedule" -->
//   - Date: Wed 8/26          the first row names the columns,
//     - Topic: Intro
//     - Due: Lab 1
//   - Fri 8/28                later rows give values in that order,
//     - Due: Lab 2            and a column's name skips ahead to it
//
// Wide enough, it is a table with the column names on top; narrower, each
// row is a card with a name beside each value. "Show as a table" holds a
// plain table either way.

// The look, kept apart from the layout below: neutral greys that read on any
// page, with the page's own font and color.
const look = {
  // #rgba: grey at 7/15, 3/15 and 2/15 opacity
  line: "1px solid #8887",
  softLine: "1px solid #8883",
  shade: "#8882",
  // a fixed line height (Canvas's is 1.5): their boxes are sized from it
  heading: "font-size:.8em;line-height:1.25;",
  label: "font-size:.85em;line-height:1.25;",
};

interface ListTableToken {
  type: "listTable";
  raw: string;
  caption: Token[];
  captionText: string;
  columns: string[];
  // per row, per column: the value's tokens, or undefined when empty
  rows: (Token[] | undefined)[][];
  // per row, per column: the value as plain text, for sizing the columns
  plain: string[][];
}

const OPEN = /^ {0,3}<!--\s*table\b([^\n]*?)-->[ \t]*\n(?:[ \t]*\n)*/;
const OPTION = /([\w-]+)(?:\s*=\s*"([^"]*)")?/g;
const LABEL =
  /^(?:\*\*|__)?([^:\n*_`[\]<>]{1,60}?)(?:\*\*|__)?:(?:\*\*|__)?(?:\s+|$)/;
const EMPTY = /^([—–-]|n\/a)?$/i;

const splitLabel = (text: string) => {
  const match = LABEL.exec(text);
  return match && { label: match[1].trim(), value: text.slice(match[0].length) };
};

const plainText = (markdown: string) =>
  markdown
    .replace(/!?\[([^\]]*)\](\([^)]*\)|\[[^\]]*\])/g, "$1")
    .replace(/[`*_]/g, "")
    .trim();

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

// A row's first value, then each of its fields, as markdown.
const valuesOf = (item: Tokens.ListItem) => {
  const fields = item.tokens.find((t): t is Tokens.List => t.type === "list");
  const first = item.tokens
    .filter((t) => t !== fields)
    .map((t) => t.raw)
    .join("")
    .trim();
  return [first, ...(fields?.items.map((f) => f.text.trim()) ?? [])];
};

// Each row's values by column: the first row's labels name the columns, a
// later value fills the next column unless it starts with a column's name.
function arrange(rows: string[][]) {
  const columns = rows[0].map((value) => splitLabel(value)?.label ?? "");
  if (columns.some((c) => !c)) return undefined;

  const arranged = rows.map((row, r) => {
    const cells: string[] = [];
    let next = 0;
    for (const value of row) {
      const labeled = splitLabel(value);
      const named = labeled ? columns.indexOf(labeled.label) : -1;
      if (named >= next) next = named;
      const column = next++;
      if (column >= columns.length) {
        console.log(`List table row ${r + 1}: more values than columns, "${value}" is left out`);
        continue;
      }
      cells[column] = named === column && labeled ? labeled.value : value;
    }
    return columns.map((_, c) => cells[c] ?? "");
  });
  return { columns, rows: arranged };
}

export const listTableExtension = {
  name: "listTable",
  level: "block" as const,
  start(src: string) {
    return src.match(/^ {0,3}<!--\s*table\b/m)?.index;
  },
  tokenizer(this: TokenizerThis, src: string): ListTableToken | undefined {
    const open = OPEN.exec(src);
    if (!open) return undefined;
    // marked's own list tokenizer, so nesting, code and blank lines inside
    // values behave exactly as in any other list
    const { tokenizer } = this.lexer as unknown as { tokenizer: Tokenizer };
    const list = tokenizer.list(src.slice(open[0].length));
    if (!list || list.ordered) {
      console.log("<!-- table --> needs a bulleted list right after it");
      return undefined;
    }

    const options = Object.fromEntries(
      [...open[1].matchAll(OPTION)].map((m) => [m[1], m[2] ?? ""])
    );
    for (const name of Object.keys(options).filter((o) => o !== "caption"))
      console.log(`<!-- table --> has no ${name} option (the only one is caption=)`);

    const table = arrange(list.items.map(valuesOf));
    if (!table) {
      console.log(
        "<!-- table --> needs a label on every value of its first row, like \"- Date: Mon\", to name the columns"
      );
      return undefined;
    }

    const caption = options.caption ?? "";
    return {
      type: "listTable",
      raw: open[0] + list.raw,
      caption: this.lexer.inline(caption),
      captionText: plainText(caption),
      columns: table.columns,
      rows: table.rows.map((row) =>
        row.map((value) =>
          EMPTY.test(value.trim()) ? undefined : this.lexer.blockTokens(value, [])
        )
      ),
      plain: table.rows.map((row) => row.map(plainText)),
    };
  },
  renderer(this: RendererThis, token: Tokens.Generic) {
    const t = token as ListTableToken;
    const cell = (tokens: Token[] | undefined) => {
      if (!tokens) return "";
      const [only] = tokens;
      return tokens.length === 1 && only.type === "paragraph"
        ? this.parser.parseInline((only as Tokens.Paragraph).tokens)
        : this.parser.parse(tokens);
    };
    const html = t.rows.map((row) => row.map(cell));
    const caption = this.parser.parseInline(t.caption);
    return (
      (caption ? `<p style="margin:0 0 4px 0;"><strong>${caption}</strong></p>` : "") +
      plainTable(t, html, caption) +
      responsiveTable(t, html)
    );
  },
};

function plainTable(t: ListTableToken, html: string[][], caption: string) {
  const td = `border:${look.line};padding:4px 8px;`;
  return `<details><summary>Show as a table</summary><div style="overflow-x:auto;"><table style="border-collapse:collapse;">${
    caption ? `<caption>${caption}</caption>` : ""
  }<thead><tr>${t.columns
    .map((c) => `<th scope="col" style="${td}text-align:left;">${escapeHtml(c)}</th>`)
    .join("")}</tr></thead><tbody style="vertical-align:top;">${html
    .map((row) => `<tr>${row.map((v) => `<td style="${td}">${v}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div></details>`;
}

// Inline styles can't hide anything, so each piece that belongs to one mode is
// sized to zero in the other: `on` is huge (and capped) when a row is wider
// than `fits`, and calc() clamps it to 0 when narrower; `off` is the reverse.
// A height is switched through a child whose padding-top is a percentage of a
// parent whose width is switched.
//
// Sizes follow the page's font, whatever it is: text widths are in ch (the
// width of "0"), heights and padding in em. A character is taken as `CH` ch
// wide, a little wider than most, so text never needs more room than given.
const CH = 1.1;

function responsiveTable(t: ListTableToken, html: string[][]) {
  const columns = t.columns.map((name, c) => {
    const values = t.plain.map((row) => row[c]);
    const lengths = values.map((v) => v.length).sort((a, b) => a - b);
    const typical = lengths[Math.floor(lengths.length * 0.75)] || 1;
    const longestWord = Math.max(
      1,
      ...values.flatMap((v) => v.split(/\s+/).map((w) => w.length))
    );
    const longestNameWord = Math.max(...name.split(" ").map((w) => w.length));
    // room for its longest word, or its heading's (.8em)
    const wordCh = Math.ceil(Math.max(longestWord, longestNameWord * 0.8) * CH);
    return {
      name,
      // room in proportion to how much it usually holds, so a column of
      // one-digit numbers stays narrow
      grow: Math.max(typical, longestNameWord),
      textCh: Math.min(16, wordCh),
      // Canvas drops overflow-wrap, so a word too long for any column
      // scrolls inside its cell rather than widening the page
      scroll: wordCh > 16,
    };
  });
  // the width a row needs on one line: each column's text, its 1em of
  // padding and its 1px line
  const fits = `${columns.reduce((sum, c) => sum + c.textCh, 0)}ch + ${columns.length * 1.1}em`;
  const on = `calc((100% - (${fits})) * 999)`;
  const off = `calc((${fits} - 100%) * 999)`;
  // wide enough for the longest word of any name (.85em), so no name
  // breaks inside a word, plus its padding
  const longestNameWord = Math.max(...t.columns.flatMap((c) => c.split(" ").map((w) => w.length)));
  const labelCh = Math.min(14, Math.max(8, Math.ceil(longestNameWord * 0.85 * CH)));
  const labelWidth = `${labelCh}ch + 1.1em`;
  // Canvas drops box-sizing, so nothing whose width matters has padding (it
  // goes on an inner div) and the 1px borders are counted in.
  const flex = (c: (typeof columns)[number], basis: string) =>
    `flex:${c.grow} 1 ${basis};min-width:calc(${c.textCh}ch + 1em);`;
  // a zero-width item whose border is the line between columns in table mode
  const separator = blank(`flex:0 0 0;border-left:${look.line};`);

  // headings are .8em with padding above; lines are 1.25 of their size
  const headerEm =
    Math.max(...columns.map((c) => linesOf(c.name, c.textCh / (0.8 * CH)))) * 0.8 * 1.25 + 0.5;
  const header = `<div style="overflow:hidden;"><div role="row" style="display:flex;height:${headerEm}em;margin-bottom:-${headerEm}em;background:${look.shade};">${columns
    .map(
      (c) =>
        `${separator}<div role="columnheader" style="${flex(c, "0")}"><div style="padding:.3em .6em 0;${look.heading}"><strong>${escapeHtml(c.name)}</strong></div></div>`
    )
    .join("")}${separator}</div>${heightSwitch(on, headerEm, 10)}</div>`;

  const label = (name: string) => {
    // in em of the row: lines of .85em text, 1.25 apart, plus padding above
    const h = linesOf(name, labelCh / (0.85 * CH)) * 0.85 * 1.25 + 0.6;
    return `<div aria-hidden="true" style="flex:0 0 calc(${labelWidth});max-width:${off};overflow:hidden;border-top:${look.softLine};border-left:${look.line};background:${look.shade};"><div style="height:${h / 0.85}em;margin-bottom:-${h / 0.85}em;padding:.45em .5em 0 .8em;${look.label}">${escapeHtml(name)}</div>${heightSwitch("100%", h, 3)}</div>`;
  };

  const rows = html.map(
    (row) =>
      `${heightSwitch(off, 0.8, 10)}<div role="row" style="border:${look.line};border-width:1px 1px 1px 0;display:flex;flex-wrap:wrap;margin-top:-1px;">${row
        .map((value, c) => {
          const column = columns[c];
          // an empty cell keeps its font, which its ch and em widths depend on
          if (!value)
            return `${separator}<div role="cell" style="${flex(column, off)}line-height:0;"><span style="font-size:0;">&nbsp;</span></div>`;
          return `${label(column.name)}<div role="cell" style="${flex(column, off)}max-width:calc(100% - (${labelWidth}) - 1px);${column.scroll ? "overflow-x:auto;" : ""}border-top:${look.softLine};"><div style="padding:.4em .5em;">${c === 0 ? `<strong>${value}</strong>` : value}</div></div>`;
        })
        .join("")}</div>`
  );

  return `<div role="table" aria-label="${escapeHtml(t.captionText)}">${header}${rows.join("")}</div>`;
}

// Space `heightEm` tall while `width` is on, none while it is 0: padding-top
// is a share of the width, which is capped at `widthEm`.
const heightSwitch = (width: string, heightEm: number, widthEm: number) =>
  `<div style="width:${width};max-width:${widthEm}em;">${blank(`padding-top:${((heightEm / widthEm) * 100).toFixed(2)}%;`)}</div>`;

// A div with nothing to show. Canvas's editor deletes empty divs when a page
// holding the table (a front page it's embedded in) is saved there, so it
// holds a space too small to take up any room.
const blank = (style: string) => `<div style="${style}font-size:0;">&nbsp;</div>`;

// The lines `text` takes wrapped at `perLine` characters, breaking between words.
const linesOf = (text: string, perLine: number) =>
  text.split(" ").reduce(
    ([lines, used], word) =>
      used > 0 && used + 1 + word.length <= perLine
        ? [lines, used + 1 + word.length]
        : [lines + 1, word.length],
    [0, 0]
  )[0];
