/**
 * Syntax highlighting for fenced code blocks, done here rather than by Canvas
 * (which has none): each token gets an inline colour (`<span style="color:…">`,
 * the one kind of styling Canvas keeps) and plain text stays plain.
 * highlight.js does the tokenizing: a small engine whose grammars are plain
 * JavaScript (BSD-3-Clause, see the README's licences section); Forth, k and
 * nemo, which it doesn't ship, are small grammars of our own in its form.
 * The block keeps whatever background it would have had without highlighting
 * (Canvas's own light gray `pre`, the preview's dark one), so there are two
 * palettes, one for each: the Canvas page gets `light`, the preview `dark`.
 */
import hljs from "highlight.js/lib/core";
import type { HLJSApi, Language } from "highlight.js";
import csharp from "highlight.js/lib/languages/csharp";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import python from "highlight.js/lib/languages/python";
import elixir from "highlight.js/lib/languages/elixir";
import ocaml from "highlight.js/lib/languages/ocaml";
import fsharp from "highlight.js/lib/languages/fsharp";
import scheme from "highlight.js/lib/languages/scheme";
import clojure from "highlight.js/lib/languages/clojure";
import smalltalk from "highlight.js/lib/languages/smalltalk";
import prolog from "highlight.js/lib/languages/prolog";

// Forth is words separated by whitespace; only the defining and control words are coloured.
const forth = (h: HLJSApi): Language => ({
  name: "Forth",
  case_insensitive: true,
  keywords: {
    $pattern: /\S+/,
    keyword:
      ": ; variable constant create does> if else then begin until while repeat again do ?do loop +loop i j leave exit recurse immediate postpone literal [ ] ['] ' include",
  },
  contains: [
    h.COMMENT(/\\ /, /$/),
    h.COMMENT(/\( /, /\)/),
    { scope: "string", begin: /(?:\.|[sScC])" /, end: /"/ },
    { scope: "number", begin: /(?<!\S)-?\d+(?!\S)/ },
  ],
});

// k: a comment is a / at the start of a line or after whitespace.
const k = (h: HLJSApi): Language => ({
  name: "k",
  contains: [{ scope: "comment", begin: /(?<![^\s])\//, end: /$/ }, h.QUOTE_STRING_MODE, h.C_NUMBER_MODE],
});

// nemo (Datalog): ?X is a variable, @import and friends are directives.
const nemo = (h: HLJSApi): Language => ({
  name: "nemo",
  aliases: ["datalog"],
  contains: [
    h.COMMENT(/%/, /$/),
    h.QUOTE_STRING_MODE,
    { scope: "keyword", begin: /@\w+|:-/ },
    { scope: "variable", begin: /\?\w+/ },
    h.C_NUMBER_MODE,
  ],
});

for (const [name, language] of Object.entries({ csharp, java, go, rust, python, elixir, ocaml, fsharp, scheme, clojure, smalltalk, prolog, forth, k, nemo }))
  hljs.registerLanguage(name, language);
hljs.registerAliases("racket", { languageName: "scheme" });

export type Palette = "light" | "dark";

// Colours by highlight.js scope (the first part of a dotted one); anything else stays plain.
// GitHub's light and dark palettes: light for Canvas's porcelain-gray pre, dark for the preview's.
const colours: Record<Palette, Record<string, string>> = {
  light: {
    keyword: "#cf222e",
    literal: "#0550ae",
    number: "#0550ae",
    symbol: "#0550ae",
    built_in: "#0550ae",
    attr: "#0550ae",
    attribute: "#0550ae",
    variable: "#953800",
    string: "#0a3069",
    regexp: "#0a3069",
    char: "#0a3069",
    comment: "#6e7781",
    quote: "#6e7781",
    doctag: "#6e7781",
    meta: "#6e7781",
    title: "#8250df",
    type: "#8250df",
    class: "#8250df",
    section: "#116329",
    name: "#116329",
    tag: "#116329",
  },
  dark: {
    keyword: "#f97583",
    literal: "#79b8ff",
    number: "#79b8ff",
    symbol: "#79b8ff",
    built_in: "#79b8ff",
    attr: "#79b8ff",
    attribute: "#79b8ff",
    variable: "#ffab70",
    string: "#9ecbff",
    regexp: "#9ecbff",
    char: "#9ecbff",
    comment: "#6a737d",
    quote: "#6a737d",
    doctag: "#6a737d",
    meta: "#6a737d",
    title: "#b392f0",
    type: "#b392f0",
    class: "#b392f0",
    section: "#85e89d",
    name: "#85e89d",
    tag: "#85e89d",
  },
};

export const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/**
 * The code as HTML with its tokens coloured in the palette; undefined for a
 * language the highlighter doesn't know. highlight.js's spans carry class names; this
 * turns each into the colour of its innermost coloured scope, and runs of one
 * colour share a span. The text is already escaped.
 */
export function highlight(code: string, language: string, palette: Palette = "light"): string | undefined {
  const lang = language.toLowerCase();
  if (!lang || !hljs.getLanguage(lang)) return undefined;
  const { value } = hljs.highlight(code, { language: lang, ignoreIllegals: true });
  const stack: (string | undefined)[] = [];
  const runs: { color: string | undefined; text: string }[] = [];
  const add = (text: string) => {
    if (!text) return;
    const color = text.trim() ? [...stack].reverse().find(Boolean) : undefined;
    const last = runs[runs.length - 1];
    if (last && last.color === color) last.text += text;
    else runs.push({ color, text });
  };
  let at = 0;
  for (const tag of value.matchAll(/<span class="([^"]*)">|<\/span>/g)) {
    add(value.slice(at, tag.index));
    at = tag.index + tag[0].length;
    if (tag[1] === undefined) stack.pop();
    else stack.push(colours[palette][tag[1].replace(/^hljs-/, "").split(/[ .]/)[0]]);
  }
  add(value.slice(at));
  return runs.map((r) => (r.color ? `<span style="color:${r.color}">${r.text}</span>` : r.text)).join("");
}
