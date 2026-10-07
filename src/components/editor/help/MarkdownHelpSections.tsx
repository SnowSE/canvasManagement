"use client";
import { C, Example, HelpSection, P } from "./HelpParts";

// Help topics for the markdown renderer (src/services/htmlMarkdownUtils.ts),
// shared by the assignment and quiz help panes.

export function MarkdownBasicsHelp() {
  return (
    <HelpSection title="Formatting text">
      <P>
        Standard markdown (GitHub flavored) works everywhere text ends up on
        Canvas.
      </P>
      <Example>{`
## Heading

**Bold**, *italic*, ~~strikethrough~~

\`inline code\`

- bullet
- list

1. numbered
2. list

> Blockquote

[Link text](https://example.com)
`}</Example>
      <P>Tables:</P>
      <Example>{`
| Task     | Points |
| -------- | -----: |
| Part one |     10 |
| Part two |      5 |
`}</Example>
      <P>Code blocks:</P>
      <Example>{`
\`\`\`python
print("hello")
\`\`\`
`}</Example>
      <P>
        Raw HTML is allowed too, and is sanitized before it is sent to Canvas.
      </P>
    </HelpSection>
  );
}

export function MathHelp() {
  return (
    <HelpSection title="Math (LaTeX)">
      <P>
        Wrap inline math in single dollar signs and display math in double
        dollar signs.
      </P>
      <Example>{`
The sequence is $F(n) = F(n-1) + F(n-2)$.

$$F(n) = F(n-1) + F(n-2)$$

$$
F(n) = \\begin{cases}
0 & \\text{if } n = 0 \\\\
1 & \\text{if } n = 1 \\\\
F(n-1) + F(n-2) & \\text{if } n > 1
\\end{cases}
$$
`}</Example>
    </HelpSection>
  );
}

export function MermaidHelp() {
  return (
    <HelpSection title="Diagrams (Mermaid)">
      <P>
        A <C>mermaid</C> code block becomes a diagram image (rendered by
        mermaid.ink). Try diagrams out in the Mermaid Live Editor linked below.
      </P>
      <Example>{`
\`\`\`mermaid
flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
\`\`\`
`}</Example>
    </HelpSection>
  );
}

export function ImagesHelp() {
  return (
    <HelpSection title="Images">
      <P>
        Images on the web can be linked directly. Files in a folder mounted
        under <C>/app/public/images</C> are uploaded to the Canvas course when
        you publish, and the link is pointed at the uploaded copy.
      </P>
      <Example>{`
![formulas](/images/facultyFiles/1405/lab-04-formulas.png)
`}</Example>
    </HelpSection>
  );
}

export function EncodedBlocksHelp() {
  return (
    <HelpSection title="Encoded blocks (content in a url)">
      <P>
        For a service that takes its content in the url (a practice quiz, a
        diagram renderer), name a fenced block with <C>encoded-name=</C> and
        reference it from a link or image as <C>{"{{name:encoding}}"}</C>. The
        block stays readable in the file; the encoded value is substituted when
        publishing.
      </P>
      <Example>{`
Take the [practice quiz](https://teichert.github.io/quizhub/?t={{pq:base64}}) first.

\`\`\`\`quiztext encoded-name=pq hide
Points: 1000
---
What does this print?
\`\`\`c#
Console.Write('h');
Console.Write('i');
\`\`\`

*a) hi
b) Compile error
\`\`\`\`
`}</Example>
      <P>
        Encodings: <C>base64</C>, <C>pako</C> (compressed, for much shorter
        urls) and <C>urlencoded</C>. The encoding is chosen where the block is
        used, so one block can feed several links.
      </P>
      <P>
        Add <C>hide</C> to keep the block itself off the page. It works on any
        fenced block, named or not.
      </P>
      <P>
        Note the four backticks: the outer fence needs <em>more</em> backticks
        than any fence inside it, or the first inner <C>```</C> ends the block
        early and the rest (answers included) is published onto the page.
      </P>
    </HelpSection>
  );
}
