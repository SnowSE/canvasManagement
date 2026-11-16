import { canonicalLanguage } from "./codeHighlight";

// Fenced code blocks in a markdown file, read the way the renderer reads them.
// Used by the editor (squiggles, completions) and by the course-wide count of
// the languages code blocks use.

export interface CodeFence {
  /** the opening fence's line */
  lineIndex: number;
  /** 0-based column just past the fence's backticks or tildes */
  infoStart: number;
  /** the language word after the fence, where it is on the line */
  language?: { word: string; start: number };
  /** ```lang hide: never rendered */
  hide: boolean;
  /** lines between the fences; an unclosed fence runs to the end of the file */
  body: string[];
}

const openingFence = /^(\s*)(`{3,}|~{3,})(.*)$/;
const closingFence = /^\s*(`{3,}|~{3,})\s*$/;

// The same reading of the info line as parseCodeInfoLine() in
// htmlMarkdownUtils.ts: the language is the first word that isn't an attribute.
export const isAttribute = (word: string) =>
  word === "hide" || word.startsWith("encoded-name=");

/** Every fenced code block in the file, outer fences only (a block quoted inside a longer fence is its body). */
export function findCodeFences(lines: string[]): CodeFence[] {
  const fences: CodeFence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = openingFence.exec(lines[i]);
    if (!open) continue;
    const [, indent, fence, info] = open;
    // a backtick fence's info line can't contain a backtick (that's inline code)
    if (fence[0] === "`" && info.includes("`")) continue;

    const infoStart = indent.length + fence.length;
    let language: CodeFence["language"];
    let hide = false;
    for (const match of info.matchAll(/\S+/g)) {
      if (match[0] === "hide") hide = true;
      if (!language && !isAttribute(match[0]))
        language = { word: match[0], start: infoStart + match.index };
    }

    let end = i + 1;
    while (end < lines.length) {
      const close = closingFence.exec(lines[end]);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) break;
      end++;
    }
    fences.push({ lineIndex: i, infoStart, language, hide, body: lines.slice(i + 1, end) });
    i = end;
  }
  return fences;
}

/** Languages the renderer handles that highlight.js doesn't know. */
const rendererLanguages = new Set(["mermaid"]);

export function isKnownFenceLanguage(word: string) {
  return rendererLanguages.has(word) || canonicalLanguage(word) !== undefined;
}

/** How many code blocks name each language, by the language's own name ("cs" counts as csharp). */
export function countFenceLanguages(text: string, counts: Record<string, number> = {}) {
  for (const fence of findCodeFences(text.split("\n"))) {
    const name = fence.language && canonicalLanguage(fence.language.word);
    if (name && name !== "plaintext") counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}
