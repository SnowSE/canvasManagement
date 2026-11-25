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

// rendered by a test (listTable.test.ts), so it stays valid
export const listTableExample = `
<!-- table caption="Schedule" -->
- Date: Wed 8/26
  - Topic: Intro
  - Due: —
- Fri 8/28
  - Scope and closures
  - Lab 1
- Mon 9/7
  - Topic: *No class: Labor Day*
`;

export function ListTableHelp() {
  return (
    <HelpSection title="Tables from lists">
      <P>
        A bulleted list after <C>{"<!-- table -->"}</C> becomes a table that
        fits any screen: on a wide one it is a table with the column names on
        top; on a phone each row is a card with a name beside each value. A{" "}
        <em>Show as a table</em> toggle above it holds a plain table either
        way.
      </P>
      <Example>{listTableExample}</Example>
      <P>
        The first row names the columns: each of its values starts with a
        label. Later rows give their values in the same order, without labels.
        Start a value with a column&apos;s name to skip ahead to it, like{" "}
        <C>Topic:</C> above. A value can be <C>—</C>, <C>-</C> or <C>n/a</C>{" "}
        to leave it empty, and can run over several lines or hold its own
        list.
      </P>
      <P>
        Two optional settings: <C>caption=</C>, and <C>group=</C> with one or
        more column names (<C>group=&quot;Week, Module&quot;</C>). Grouped
        columns leave the rows; a shaded row showing their values starts each
        run of rows that share them. A grouped value can be left empty to keep
        the one above. The look is built in, so every table matches.
      </P>
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
  <>
    <HelpSection title="Images">
      <P>
        Images on the web can be linked directly. A file in your faculty files
        folder is written with <C>/images/facultyFiles/</C> in front of its
        path in that folder. Letter case must match exactly, and a space is
        written <C>%20</C>. Local images are uploaded to the Canvas course when
        you add or update the item in Canvas, and the link is pointed at the
        uploaded copy. A changed file is uploaded again.
      </P>
      <Example>{`
![formulas](/images/facultyFiles/1405/lab-04-formulas.png)
![diagram](/images/facultyFiles/1405/Lab%2004%20Diagram.png)
`}</Example>
      <P>
        An image that won&apos;t load is replaced in the preview by a note
        saying why, usually with the path to use instead, and publishing stops
        with the same note.
      </P>
    </HelpSection>
    <HelpSection title="Files (HTML demos, SVG drawings, stylesheets, PDFs)">
      <P>
        Any file in a module&apos;s <C>files</C> folder is one of the
        course&apos;s files: the Modules pane lists it in that module, and
        it opens in the editor (a text file to edit; any file to preview
        and send to Canvas). Link to
        it, or show it as an image, by its path through the <C>files</C>{" "}
        folder. The preview uses the file on disk.
      </P>
      <Example>{`
Try the [K koans](../files/kkoans.html), or start at [level 2](../files/kkoans.html#level-2).

![the parse tree](../files/parse-tree.svg)
`}</Example>
      <P>
        Canvas gets the file only when you add it there yourself:{" "}
        <strong>Add to Canvas</strong> in the file&apos;s own footer, then{" "}
        <strong>Publish</strong>, as for a page. An item that links to the
        file points at the copy Canvas has, which opens with its scripts
        running (a Canvas page would strip them). Adding or updating an
        item that links to a file Canvas doesn&apos;t have stops with a
        note naming the file, so no dead link is sent; until the file is
        published, students who follow the link are refused.
      </P>
      <P>
        <C>../files/name</C> is the file of that name in a module&apos;s{" "}
        <C>files</C> folder; another module&apos;s file is written with its
        module, <C>../../01%20-%20Intro/files/name</C> (a space in a
        markdown link is written <C>%20</C>), which is needed when two
        modules each have a file of the name. A file kept anywhere else
        (beside the pages, in a starter project) is not one of the
        course&apos;s files, and a link that doesn&apos;t go through a{" "}
        <C>files</C> folder is left as written.
      </P>
    </HelpSection>
  </>
  );
}

export function CodeBlocksHelp() {
  return (
    <HelpSection title="Code blocks (syntax highlighting)">
      <P>
        A fenced block whose first line names a language the app knows is
        coloured by that language, as a code editor colours it, in the preview
        and on the Canvas page (as inline colours, the one styling Canvas
        keeps; the block itself looks as it did). To leave a block plain, name
        no language.
      </P>
      <Example>{`
\`\`\`python
def area(r):  # a circle
    return 3.14159 * r ** 2
\`\`\`
`}</Example>
      <P>
        Languages: C#, Java, Go, Rust, Python, Elixir, OCaml, F#, Scheme (Racket
        too), Clojure, Smalltalk, Prolog, nemo, Forth and k. Any other language,
        or a fence with none, is left as plain text.
      </P>
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
