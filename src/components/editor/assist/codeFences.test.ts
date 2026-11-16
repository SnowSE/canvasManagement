import { describe, expect, it } from "vitest";
import type { editor, Position } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import {
  codeFenceMarkers,
  codeFenceQuickFixes,
  fenceLanguageCompletions,
  fenceLanguageGhostText,
  findCodeFences,
  unknownFenceLanguages,
} from "./codeFences";

// just enough of monaco and a text model for the providers
const monaco = {
  MarkerSeverity: { Warning: 4 },
  languages: { CompletionItemKind: { EnumMember: 16 } },
} as unknown as typeof MonacoNs;
const modelOf = (text: string) =>
  ({
    getLinesContent: () => text.split("\n"),
    getVersionId: () => 1,
    uri: "file:///x.md",
  }) as unknown as editor.ITextModel;
const at = (lineNumber: number, column: number) => ({ lineNumber, column }) as Position;

const csharp = `public class Order
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}`;

describe("findCodeFences", () => {
  it("finds each block with its language and body", () => {
    const fences = findCodeFences("Intro\n\n```python\nprint(1)\n```\n\n~~~\nplain\n~~~".split("\n"));
    expect(fences).toEqual([
      { lineIndex: 2, infoStart: 3, language: { word: "python", start: 3 }, hide: false, body: ["print(1)"] },
      { lineIndex: 6, infoStart: 3, language: undefined, hide: false, body: ["plain"] },
    ]);
  });

  it("reads the language past the attributes, like the renderer", () => {
    const [fence] = findCodeFences(["```hide encoded-name=q pyhton", "x", "```"]);
    expect(fence.language).toEqual({ word: "pyhton", start: 23 });
    expect(fence.hide).toBe(true);
  });

  it("treats a shorter fence inside a longer one as body, and finds indented fences", () => {
    const fences = findCodeFences(
      ["````markdown", "```js", "x", "```", "````", "1. Step", "   ```bash", "   ls", "   ```"],
    );
    expect(fences.map((f) => f.language?.word)).toEqual(["markdown", "bash"]);
    expect(fences[0].body).toEqual(["```js", "x", "```"]);
    expect(fences[1].language?.start).toBe(6);
  });

  it("runs an unclosed fence to the end of the file", () => {
    const [fence] = findCodeFences(["```", "a", "b"]);
    expect(fence.body).toEqual(["a", "b"]);
  });

  it("ignores inline code that starts a line", () => {
    expect(findCodeFences(["```inline``` and more"])).toEqual([]);
  });
});

describe("unknown fence languages", () => {
  it("flags only languages the highlighter doesn't know", () => {
    const lines = "```pyhton\nx\n```\n```python\nx\n```\n```cs\nx\n```\n```mermaid\nA-->B\n```\n```text\nx\n```\n```\nx\n```".split("\n");
    expect(unknownFenceLanguages(lines).map((f) => f.language.word)).toEqual(["pyhton"]);
  });

  it("leaves hidden blocks alone, since they are never shown", () => {
    expect(unknownFenceLanguages(["```quiztext hide", "x", "```"])).toEqual([]);
  });

  it("squiggles the word and suggests the likely typo fix", () => {
    const [marker] = codeFenceMarkers(monaco, modelOf("Text\n\n```pyhton\nprint(1)\n```"));
    expect(marker).toMatchObject({ startLineNumber: 3, startColumn: 4, endColumn: 10 });
    expect(marker.message).toContain("Did you mean python?");
  });

  it("offers the typo fix first as the quick fix, then guesses and text", () => {
    const model = modelOf("```pyhton\ndef f(x):\n    return x * 2\n```");
    const markers = codeFenceMarkers(monaco, model);
    const actions = codeFenceQuickFixes(model, markers);
    expect(actions[0]).toMatchObject({ title: "Change to python", isPreferred: true });
    expect(actions.at(-1)?.title).toBe("Change to text");
    expect(actions[0].edit?.edits[0]).toMatchObject({
      textEdit: { range: { startLineNumber: 1, startColumn: 4, endColumn: 10 }, text: "python" },
    });
  });
});

describe("completing the language after a fence", () => {
  const file = `Earlier:

\`\`\`csharp
var x = 1;
\`\`\`

Now:

\`\`\`
${csharp}
\`\`\``;

  it("puts the language guessed from the code first", () => {
    const list = fenceLanguageCompletions(monaco, modelOf(file), at(9, 4))!;
    const first = [...list.suggestions].sort((a, b) => a.sortText!.localeCompare(b.sortText!))[0];
    expect(first).toMatchObject({ label: "csharp", preselect: true });
    expect(first.detail).toContain("guessed from the code");
  });

  it("finds a language by its alias and replaces the word being typed", () => {
    const list = fenceLanguageCompletions(monaco, modelOf("```cs\nx\n```"), at(1, 6))!;
    const csharpItem = list.suggestions.find((s) => s.label === "csharp")!;
    expect(csharpItem.filterText).toContain("cs");
    expect(csharpItem.range).toMatchObject({ startColumn: 4, endColumn: 6 });
    expect(list.suggestions.map((s) => s.label)).toEqual(
      expect.arrayContaining(["python", "javascript", "html", "text", "mermaid"]),
    );
  });

  it("inserts the language in front of an attribute instead of replacing it", () => {
    const list = fenceLanguageCompletions(monaco, modelOf("```hide\nx\n```"), at(1, 4))!;
    expect(list.suggestions.find((s) => s.label === "python")).toMatchObject({
      insertText: "python ",
      range: { startColumn: 4, endColumn: 4 },
    });
    expect(fenceLanguageCompletions(monaco, modelOf("```hide\nx\n```"), at(1, 6))).toBeUndefined();
  });

  it("leans on the course's languages for a file's first block", () => {
    const text = "```\n" + csharp + "\n```";
    const list = fenceLanguageCompletions(monaco, modelOf(text), at(1, 4), { csharp: 50 })!;
    expect(list.suggestions.find((s) => s.preselect)?.label).toBe("csharp");
  });

  it("offers nothing on a closing fence or away from the language", () => {
    expect(fenceLanguageCompletions(monaco, modelOf("```js\nx\n```"), at(3, 4))).toBeUndefined();
    expect(fenceLanguageCompletions(monaco, modelOf("```js hide\nx\n```"), at(1, 11))).toBeUndefined();
    expect(fenceLanguageCompletions(monaco, modelOf("```js\nx\n```"), at(1, 2))).toBeUndefined();
  });
});

describe("ghost text on a bare fence", () => {
  it("suggests the guessed language at the end of a bare opening fence", () => {
    const text = "```csharp\nvar y = 2;\n```\n\n```\n" + csharp + "\n```";
    expect(fenceLanguageGhostText(modelOf(text), at(5, 4)).items).toMatchObject([
      { insertText: "csharp" },
    ]);
  });

  it("suggests nothing when the fence has a language or no code yet", () => {
    expect(fenceLanguageGhostText(modelOf("```js\nx\n```"), at(1, 6)).items).toEqual([]);
    expect(fenceLanguageGhostText(modelOf("Text\n```"), at(2, 4)).items).toEqual([]);
  });
});
