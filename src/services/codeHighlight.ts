import hljs from "highlight.js/lib/common";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import nginx from "highlight.js/lib/languages/nginx";
import powershell from "highlight.js/lib/languages/powershell";
import protobuf from "highlight.js/lib/languages/protobuf";
import elixir from "highlight.js/lib/languages/elixir";
import erlang from "highlight.js/lib/languages/erlang";
import { kusto } from "./kustoLanguage";

// The common set (python, javascript, typescript, csharp, java, c, cpp, go,
// rust, sql, bash, shell, json, yaml, xml/html, css, diff, markdown, ...) plus
// the ones course material uses that aren't in it.
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("nginx", nginx);
hljs.registerLanguage("powershell", powershell);
hljs.registerLanguage("protobuf", protobuf);
hljs.registerLanguage("elixir", elixir);
hljs.registerLanguage("erlang", erlang);
hljs.registerLanguage("kusto", kusto);
// highlight.js has no Razor; its HTML coloring covers most of a .cshtml file
hljs.registerAliases(["razor", "cshtml"], { languageName: "xml" });

// Canvas drops <style> blocks and has no highlight.js stylesheet, so the
// colors have to travel as inline styles on each span. These are GitHub's
// light theme, readable on Canvas's light code blocks. The spans keep their
// hljs-* class too, which is how the dark preview in this app recolors them
// (globals.css).
const KEYWORD = "color:#d73a49";
const TITLE = "color:#6f42c1";
const CONSTANT = "color:#005cc5";
const STRING = "color:#032f62";
const BUILT_IN = "color:#e36209";
const COMMENT = "color:#6a737d";
const TAG = "color:#22863a";

const scopeStyles: Record<string, string> = {
  keyword: KEYWORD,
  doctag: KEYWORD,
  "template-tag": KEYWORD,
  "template-variable": KEYWORD,
  type: KEYWORD,
  title: TITLE,
  attr: CONSTANT,
  attribute: CONSTANT,
  literal: CONSTANT,
  meta: CONSTANT,
  number: CONSTANT,
  operator: CONSTANT,
  variable: CONSTANT,
  "selector-attr": CONSTANT,
  "selector-class": CONSTANT,
  "selector-id": CONSTANT,
  string: STRING,
  regexp: STRING,
  built_in: BUILT_IN,
  symbol: BUILT_IN,
  comment: COMMENT,
  code: COMMENT,
  formula: COMMENT,
  name: TAG,
  quote: TAG,
  "selector-tag": TAG,
  "selector-pseudo": TAG,
  section: "color:#005cc5;font-weight:bold",
  bullet: "color:#735c0f",
  emphasis: "font-style:italic",
  strong: "font-weight:bold",
  addition: "color:#22863a;background-color:#f0fff4",
  deletion: "color:#b31d28;background-color:#ffeef0",
};

// highlight.js output is escaped text and <span class="hljs-scope ...">, where
// a sub-scope follows the scope as a second class ("hljs-title function_").
const spanOpenRegex = /<span class="hljs-([\w-]+)([^"]*)">/g;

function inlineStyles(html: string) {
  return html.replace(spanOpenRegex, (open, scope: string) => {
    const style = scopeStyles[scope];
    return style ? open.replace(/">$/, `" style="${style}">`) : open;
  });
}

/** The language's own name for any name or alias highlight.js knows ("cs" is "csharp"). */
export function canonicalLanguage(word: string) {
  const language = hljs.getLanguage(word);
  if (!language) return undefined;
  return hljs.listLanguages().find((name) => hljs.getLanguage(name) === language);
}

export interface LanguageChoice {
  /** what goes after the fence */
  name: string;
  /** highlight.js's display name, e.g. "C#" */
  title: string;
  aliases: string[];
}

// Offered by name in the editor. "plaintext" is offered as "text", the shorter
// alias, and html is its own entry though highlight.js files it under xml.
const notOffered = new Set(["plaintext", "php-template", "python-repl", "wasm"]);

export function languageChoices(): LanguageChoice[] {
  const choices = hljs
    .listLanguages()
    .filter((name) => !notOffered.has(name))
    .map((name) => {
      const language = hljs.getLanguage(name)!;
      return { name, title: language.name ?? name, aliases: language.aliases ?? [] };
    });
  choices.push(
    { name: "html", title: "HTML", aliases: [] },
    { name: "text", title: "Plain text, not colored", aliases: ["plaintext", "txt"] },
  );
  return choices;
}

/** The known name or alias nearest a misspelled one, if any is close enough to be a typo. */
export function closestLanguage(word: string) {
  const lower = word.toLowerCase();
  const candidates = languageChoices().flatMap((c) => [c.name, ...c.aliases]);
  const allowed = lower.length <= 4 ? 1 : 2;
  let best: { name: string; distance: number } | undefined;
  for (const name of candidates) {
    const distance = editDistance(lower, name);
    if (distance <= allowed && (!best || distance < best.distance))
      best = { name, distance };
  }
  return best?.name;
}

function editDistance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const swapped =
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        swapped ? previous[j - 2] + 1 : Infinity,
      );
    }
    previous = current;
  }
  return previous[b.length];
}

// What a guess is chosen from: the languages that turn up in course material.
// The full set guesses worse; with ruby, perl and friends in it, short C# and
// Python snippets are taken for those more often than not.
const guessable = [
  "python", "javascript", "typescript", "csharp", "java", "c", "cpp", "go",
  "rust", "sql", "bash", "json", "yaml", "xml", "css", "scss", "dockerfile",
  "powershell", "kotlin", "swift", "php", "diff", "makefile", "ini",
  "graphql", "protobuf", "nginx", "markdown", "elixir",
];

/** Languages a guess leans toward: the file's other code blocks, and the course's. */
export interface GuessContext {
  /** languages of the file's other code blocks */
  file?: Iterable<string>;
  /** how many code blocks in the course name each language */
  course?: Record<string, number>;
}

/**
 * Languages the code is most likely in, best first. Measured on the labeled
 * blocks in real course files: highlight.js alone picks the right language
 * for about 60% of them. Favoring the file's other languages, and less so the
 * course's, raises that to 91% (82% for a file's first block, which has no
 * other blocks to go on). A runner-up is kept only when it scores at least
 * half what the first does: that shows about 1.5 guesses instead of 3 and
 * still includes the right one 97% of the time.
 */
export function guessLanguages(code: string, context: GuessContext = {}, count = 3) {
  const sample = code.slice(0, 4000);
  if (!sample.trim()) return [];
  const inFile = new Set(
    [...(context.file ?? [])].map((word) => canonicalLanguage(word)).filter(Boolean),
  );
  // a language the course uses a few times, not a one-off
  const inCourse = new Set(
    Object.entries(context.course ?? {})
      .filter(([, blocks]) => blocks >= 3)
      .map(([name]) => canonicalLanguage(name)),
  );
  const scored: { name: string; score: number }[] = [];
  let evidence = 0;
  for (const name of guessable) {
    const result = hljs.highlight(sample, { language: name, ignoreIllegals: false });
    if (result.illegal) continue;
    evidence = Math.max(evidence, result.relevance);
    const score = inFile.has(name)
      ? result.relevance * 2 + 5
      : inCourse.has(name)
        ? result.relevance * 1.5 + 2
        : result.relevance;
    if (score > 0) scored.push({ name, score });
  }
  // Nothing looks like any language: the file's and course's languages alone
  // shouldn't turn prose into a guess.
  if (evidence === 0) return [];
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, count)
    .filter(({ score }, i) => i === 0 || score >= scored[0].score / 2)
    .map(({ name }) => name);
}

/**
 * The inside of a <code> element for a fenced block in `language`, colored with
 * inline styles, or undefined when highlight.js doesn't know the language (the
 * block is then rendered plain). No language means no highlighting: guessing
 * gets prose and pseudo-code wrong too often.
 */
export function highlightCode(code: string, language: string) {
  if (!language || !hljs.getLanguage(language)) return undefined;
  const { value } = hljs.highlight(code, { language, ignoreIllegals: true });
  return inlineStyles(value);
}
