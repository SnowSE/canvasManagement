import { describe, expect, it } from "vitest";
import { markdownToHtmlNoImages } from "./htmlMarkdownUtils";
import { closestLanguage, guessLanguages } from "./codeHighlight";
import { htmlToTextLines } from "./utils/htmlTextDiff";

const textOf = (html: string) => htmlToTextLines(html).join("\n");

describe("syntax highlighting fenced code blocks", () => {
  it("colors a known language with inline styles, which survive the trip to Canvas", () => {
    const html = markdownToHtmlNoImages('```python\ndef greet(name):\n    return "hi " + name  # say hi\n```');

    expect(html).toContain('<pre><code class="language-python">');
    expect(html).toMatch(/<span class="hljs-keyword" style="color:#d73a49">def<\/span>/);
    expect(html).toMatch(/<span class="hljs-string" style="color:#032f62">"hi "<\/span>/);
    expect(html).toMatch(/<span class="hljs-comment" style="color:#6a737d"># say hi<\/span>/);
  });

  it("keeps the code's text exactly, escaping included", () => {
    const code = 'if (a < b && c > "d") {\n  return;\n}';
    const html = markdownToHtmlNoImages("```js\n" + code + "\n```");

    expect(html).not.toContain("<b");
    expect(textOf(html)).toBe(textOf(markdownToHtmlNoImages("```\n" + code + "\n```")));
  });

  it("accepts language aliases", () => {
    for (const lang of ["js", "ts", "cs", "py", "sh", "yml", "html", "dockerfile"]) {
      expect(markdownToHtmlNoImages("```" + lang + "\nx = 1\n```")).toContain(
        `<code class="language-${lang}">`,
      );
    }
    expect(markdownToHtmlNoImages("```cs\nclass Foo {}\n```")).toContain(
      'style="color:#d73a49">class</span>',
    );
  });

  it("leaves a block with no language or an unknown one uncolored", () => {
    expect(markdownToHtmlNoImages("```\nint x = 1;\n```")).not.toContain("<span");
    expect(markdownToHtmlNoImages("```pseudo\nint x = 1;\n```")).not.toContain("<span");
  });

  it("still honors hide and encoded-name= on a highlighted block", () => {
    const html = markdownToHtmlNoImages(
      "```python encoded-name=src\nprint(1)\n```\n\n[run](https://example.com/?c={{src:urlencoded}})",
    );
    expect(html).toContain('<code class="language-python">');
    expect(html).toContain("c=print(1)");
    expect(markdownToHtmlNoImages("```python hide\nprint(1)\n```")).toBe("");
  });

  it("highlights a block inside a list item", () => {
    const html = markdownToHtmlNoImages("1. Run:\n\n   ```bash\n   echo hi\n   ```\n");
    expect(html).toMatch(/<li>[\s\S]*<span class="hljs-built_in"[^>]*>echo<\/span>/);
  });

  it("leaves mermaid blocks to the diagram renderer", () => {
    const html = markdownToHtmlNoImages("```mermaid\ngraph TD\nA-->B\n```");
    expect(html).toContain("mermaid.ink");
    expect(html).not.toContain("hljs");
  });
});

describe("closestLanguage", () => {
  it("fixes a typo", () => {
    expect(closestLanguage("pyhton")).toBe("python");
    expect(closestLanguage("javscript")).toBe("javascript");
    expect(closestLanguage("Csharp")).toBe("csharp");
  });

  it("doesn't stretch to a word that only looks like a language", () => {
    expect(closestLanguage("output")).toBeUndefined();
    expect(closestLanguage("pseudo")).toBeUndefined();
  });
});

describe("guessLanguages", () => {
  const order = `public class Order
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}`;

  it("guesses from the code alone", () => {
    expect(guessLanguages("def greet(name):\n    print(f\"hi {name}\")\n    return None\n")).toContain("python");
  });

  it("favors languages the file already uses", () => {
    expect(guessLanguages(order, { file: ["cs"] })[0]).toBe("csharp");
  });

  it("favors languages the course uses a few times", () => {
    expect(guessLanguages(order, { course: { csharp: 40 } })[0]).toBe("csharp");
    // a one-off in the course doesn't count
    expect(guessLanguages(order, { course: { kotlin: 1 } })).toEqual(guessLanguages(order));
  });

  it("drops runners-up that score well under the first guess", () => {
    expect(guessLanguages(order, { file: ["csharp"] })).toEqual(["csharp"]);
  });

  it("guesses nothing for an empty block", () => {
    expect(guessLanguages("  \n")).toEqual([]);
  });
});
