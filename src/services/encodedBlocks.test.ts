import { describe, it, expect, vi, afterEach } from "vitest";
import { markdownToHtmlNoImages, pakoDeflateBase64Url } from "./htmlMarkdownUtils";

// undo `base64`: percent-escaping, then base64, then utf-8
const decodeBase64Param = (param: string) => {
  const binary = atob(decodeURIComponent(param));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const hrefIn = (html: string) => /href="([^"]*)"/.exec(html)?.[1] ?? "";
const srcIn = (html: string) => /src="([^"]*)"/.exec(html)?.[1] ?? "";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("encoded-name= feeding a {{name:encoding}} slot", () => {
  it("round-trips quiz text through base64 into a link, the way quizhub takes it", () => {
    const quiz = `Points: 1000
Time: 15

# Class 1 Review

## What does this print?

1. [x] hi
2. [ ] Compile error`;
    const html = markdownToHtmlNoImages(
      `Take the [practice quiz](https://teichert.github.io/quizhub/?t={{pq:base64}}) before class.

\`\`\`quiztext encoded-name=pq hide
${quiz}
\`\`\``
    );

    const href = hrefIn(html);
    expect(href.startsWith("https://teichert.github.io/quizhub/?t=")).toBe(true);
    expect(decodeBase64Param(href.split("?t=")[1])).toBe(quiz);
  });

  it("base64 survives characters btoa() alone would mangle", () => {
    const text = 'Which dash — and which “quotes”?';
    const html = markdownToHtmlNoImages(
      `[q](https://x.example.com/?t={{d:base64}})

\`\`\`text encoded-name=d hide
${text}
\`\`\``
    );
    expect(decodeBase64Param(hrefIn(html).split("?t=")[1])).toBe(text);
  });

  it("urlencodes into a data: uri, which is how an inline svg becomes an image", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>';
    const html = markdownToHtmlNoImages(
      `![circle](data:image/svg+xml,{{c:urlencoded}})

\`\`\`svg encoded-name=c hide
${svg}
\`\`\``
    );
    expect(srcIn(html)).toBe(`data:image/svg+xml,${encodeURIComponent(svg)}`);
  });

  it("does not double-encode, and leaves later query params intact", () => {
    const html = markdownToHtmlNoImages(
      `[go](https://example.com/?q={{d:urlencoded}}&done=1)

\`\`\`text encoded-name=d hide
a b&c%d
\`\`\``
    );
    // The & separating the two params is a literal the author wrote, so it is
    // HTML-escaped in the serialized attribute; a browser reads it back as "&".
    // Only the block's own & and % come through percent-encoded.
    expect(hrefIn(html)).toBe(
      `https://example.com/?q=${encodeURIComponent("a b&c%d")}&amp;done=1`
    );
  });

  it("reaches the same url pako-compressed as the mermaid renderer does", () => {
    const data = '{"code":"graph TD;\\n A-->B;","mermaid":{"theme":"default"}}';
    const html = markdownToHtmlNoImages(
      `![diagram](https://mermaid.ink/img/pako:{{m:pako}}?type=svg)

\`\`\`json encoded-name=m hide
${data}
\`\`\``
    );
    expect(srcIn(html)).toBe(
      `https://mermaid.ink/img/pako:${pakoDeflateBase64Url(data)}?type=svg`
    );
  });

  it("encodes one block two different ways", () => {
    const html = markdownToHtmlNoImages(
      `[plain](https://a.example.com/?q={{d:urlencoded}}) and [packed](https://b.example.com/?q={{d:pako}})

\`\`\`text encoded-name=d hide
some shared content
\`\`\``
    );
    expect(html).toContain(
      `href="https://a.example.com/?q=${encodeURIComponent("some shared content")}"`
    );
    expect(html).toContain(
      `href="https://b.example.com/?q=${pakoDeflateBase64Url("some shared content")}"`
    );
  });

  it("fills a slot in ordinary prose, not just in a url", () => {
    const html = markdownToHtmlNoImages(
      `The encoded form is {{d:urlencoded}}.

\`\`\`text encoded-name=d hide
a b
\`\`\``
    );
    expect(html).toContain("The encoded form is a%20b.");
  });

  it("keeps a named block visible unless it is also hidden", () => {
    const html = markdownToHtmlNoImages(
      `\`\`\`svg encoded-name=c
<svg id="x"/>
\`\`\`

Rendered: ![circle](data:image/svg+xml,{{c:urlencoded}})`
    );
    expect(html).toContain('<pre><code class="language-svg">');
    // < and > stay escaped; DOMPurify re-serializes text content, where a
    // double quote needs no escaping.
    expect(html).toContain('&lt;svg id="x"/&gt;');
    expect(srcIn(html)).toBe(
      `data:image/svg+xml,${encodeURIComponent('<svg id="x"/>')}`
    );
  });

  it("does not care what order the attributes are in", () => {
    const html = markdownToHtmlNoImages(
      `[a](https://example.com/?q={{d:urlencoded}})

\`\`\`text hide encoded-name=d
x y
\`\`\``
    );
    expect(hrefIn(html)).toBe("https://example.com/?q=x%20y");
  });

  it("works on a block indented inside a list item", () => {
    const html = markdownToHtmlNoImages(
      `1. Read chapter 3
2. Take the [quiz](https://example.com/?q={{pq:urlencoded}})

   \`\`\`quiztext encoded-name=pq hide
   Q: Why?
   \`\`\`
`
    );
    expect(html).toContain("<li>");
    expect(hrefIn(html)).toBe("https://example.com/?q=Q%3A%20Why%3F");
  });

  it("works inside a GFM table cell", () => {
    const html = markdownToHtmlNoImages(
      `| Link |
| --- |
| [go](https://example.com/?q={{t:urlencoded}}) |

\`\`\`text encoded-name=t hide
cell
\`\`\``
    );
    expect(hrefIn(html)).toBe("https://example.com/?q=cell");
  });

  it("does not leak block definitions between documents", () => {
    markdownToHtmlNoImages(
      "```text encoded-name=leaky hide\nfirst document\n```"
    );
    const html = markdownToHtmlNoImages("[a](https://example.com/?q={{leaky:urlencoded}})");
    expect(hrefIn(html)).not.toContain("first%20document");
  });
});

describe("hide, on its own", () => {
  it("drops any fenced block that carries it", () => {
    const html = markdownToHtmlNoImages(
      "Before.\n\n```js hide\nconst answerKey = 42;\n```\n\nAfter."
    );
    expect(html).toContain("<p>Before.</p>");
    expect(html).toContain("<p>After.</p>");
    expect(html).not.toContain("answerKey");
  });

  it("works with no language on the info line", () => {
    const html = markdownToHtmlNoImages("Before.\n\n```hide\ngone\n```\n\nAfter.");
    expect(html).not.toContain("gone");
    expect(html).not.toContain("language-hide");
  });
});

describe("blocks with no attributes are untouched", () => {
  it("renders an ordinary fenced block exactly as before", () => {
    const html = markdownToHtmlNoImages('```js\nconst x = 1 < 2 && "a";\n```');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain("const x = 1 &lt; 2 &amp;&amp; \"a\";");
  });

  it("renders a fenced block with no info line as before", () => {
    const html = markdownToHtmlNoImages("```\nplain & <text>\n```");
    expect(html).toContain("<pre><code>plain &amp; &lt;text&gt;");
  });
});

describe("slots that cannot be resolved", () => {
  it("leaves an undefined name as written and warns", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const html = markdownToHtmlNoImages("Prose with {{notAName:urlencoded}} in it.");
    expect(html).toContain("{{notAName:urlencoded}}");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("notAName"));
  });

  it("leaves a fence quoted inside a wider fence alone", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const html = markdownToHtmlNoImages(
      "````\n[q](https://x.example.com/?t={{pq:base64}})\n\n```quiztext encoded-name=pq hide\nsample\n```\n````"
    );
    expect(html).toContain("encoded-name=pq hide");
    expect(html).toContain("sample");
    expect(html).toContain("{{pq:base64}}");
  });

  it("throws on an unknown encoding for a block that does exist", () => {
    expect(() =>
      markdownToHtmlNoImages(
        "[a](https://example.com/?q={{d:notarealencoding}})\n\n```text encoded-name=d hide\nx\n```"
      )
    ).toThrow(/Unknown encoding "notarealencoding"/);
  });
});
