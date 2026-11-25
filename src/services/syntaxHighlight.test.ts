import { describe, expect, it } from "vitest";
import { highlight } from "./syntaxHighlight";

/** The coloured runs, in order, as colour:text. */
const coloured = (html: string) =>
  [...html.matchAll(/<span style="color:(#[0-9a-f]{6})">(.*?)<\/span>/gs)].map(([, colour, text]) => `${colour}:${text}`);
const KEYWORD = "#cf222e";
const STRING = "#0a3069";
const COMMENT = "#6e7781";
const NUMBER = "#0550ae";
const VARIABLE = "#953800";

describe("highlight", () => {
  it("is undefined for a language it doesn't know, so marked renders the block as before", () => {
    expect(highlight("SELECT 1", "sql")).toBeUndefined();
    expect(highlight("x", "")).toBeUndefined();
  });

  it("leaves plain text plain, escaped, and escapes inside a span too", () => {
    expect(highlight("hello world", "python")).toBe("hello world");
    expect(highlight("# it's & <b>", "python")).toBe(`<span style="color:${COMMENT}"># it&#x27;s &amp; &lt;b&gt;</span>`);
  });

  it("colours a Python line, one span per run of a colour, from the innermost scope", () => {
    expect(coloured(highlight(`def f():  # c\n    return "s"`, "python")!)).toEqual([
      `${KEYWORD}:def`, "#8250df:f", `${COMMENT}:# c`, `${KEYWORD}:return`, `${STRING}:&quot;s&quot;`,
    ]);
  });

  it("has a dark palette for the preview, the light one for Canvas's gray pre by default", () => {
    expect(highlight("x = 1", "python", "dark")).toBe('x = <span style="color:#79b8ff">1</span>');
    expect(highlight("x = 1", "python")).toBe(`x = <span style="color:${NUMBER}">1</span>`);
  });

  it("knows the fence names the course uses", () => {
    for (const lang of ["c#", "csharp", "python", "rust", "racket", "scheme", "clojure", "ocaml", "smalltalk", "prolog", "elixir", "java", "go", "forth", "k", "nemo", "datalog"])
      expect(highlight("x", lang), lang).toBeDefined();
  });

  it("knows C#'s verbatim strings, chars and comments", () => {
    expect(coloured(highlight(`var s = @"a ""q"" b"; char c = '\\n'; // d`, "c#")!)).toEqual([
      `${KEYWORD}:var`, `${STRING}:@&quot;a &quot;&quot;q&quot;&quot; b&quot;`, `${NUMBER}:char`, `${STRING}:&#x27;\\n&#x27;`, `${COMMENT}:// d`,
    ]);
  });

  it("knows Smalltalk's strings and comments", () => {
    expect(coloured(highlight(`"a comment" 'it''s' true`, "smalltalk")!)).toEqual([`${COMMENT}:&quot;a comment&quot;`, `${STRING}:&#x27;it&#x27;&#x27;s&#x27;`, `${KEYWORD}:true`]);
  });

  it("knows Forth's words, both comment forms and strings, in either case", () => {
    const code = `: sq ( n -- n*n ) dup * ; \\ square\n." hi" 10 sq . IF`;
    expect(coloured(highlight(code, "forth")!)).toEqual([
      `${KEYWORD}::`, `${COMMENT}:( n -- n*n )`, `${KEYWORD}:;`, `${COMMENT}:\\ square`, `${STRING}:.&quot; hi&quot;`, `${NUMBER}:10`, `${KEYWORD}:IF`,
    ]);
  });

  it("knows that k's / is a comment only after whitespace", () => {
    expect(coloured(highlight(`a%b / divide\n{(x+1)!10}/5\n/ whole line`, "k")!)).toEqual([
      `${COMMENT}:/ divide`, `${NUMBER}:1`, `${NUMBER}:10`, `${NUMBER}:5`, `${COMMENT}:/ whole line`,
    ]);
  });

  it("knows nemo's directives, variables, strings and comments", () => {
    const code = `@import e :- csv{resource="e.csv"}.\nreach(?X, ?Y) :- edge(?X, ?Y). % path`;
    expect(coloured(highlight(code, "nemo")!)).toEqual([
      `${KEYWORD}:@import`, `${KEYWORD}::-`, `${STRING}:&quot;e.csv&quot;`, `${VARIABLE}:?X`, `${VARIABLE}:?Y`, `${KEYWORD}::-`, `${VARIABLE}:?X`, `${VARIABLE}:?Y`, `${COMMENT}:% path`,
    ]);
  });
});
