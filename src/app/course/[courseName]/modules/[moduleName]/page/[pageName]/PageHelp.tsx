"use client";
import {
  C,
  Example,
  HelpLinks,
  HelpPanel,
  HelpSection,
  P,
} from "@/components/editor/help/HelpParts";
import {
  EncodedBlocksHelp,
  ImagesHelp,
  ListTableHelp,
  MarkdownBasicsHelp,
  MathHelp,
  MermaidHelp,
} from "@/components/editor/help/MarkdownHelpSections";

export function PageHelp() {
  return (
    <HelpPanel>
      <HelpSection title="File layout">
        <P>
          One setting, then a <C>---</C> line, then the page in markdown.{" "}
          <C>DueDateForOrdering</C> only decides where the page sits on the
          calendar and in its module.
        </P>
        <Example>{`
DueDateForOrdering: 08/26/2026 23:59:00
---

# Course schedule

What students should read, in markdown.
`}</Example>
      </HelpSection>

      <MarkdownBasicsHelp />

      <HelpSection title="Links to other course files">
        <P>
          Link to another page the way Canvas resolves it, by its title in
          lowercase with dashes; the preview opens it here. A relative path to
          an assignment or quiz file is rewritten to its Canvas url when
          publishing.
        </P>
        <Example>{`
[Belt Tour](../pages/belt-tour)
[Lab 2](<../assignments/Lab 2.md>)
`}</Example>
      </HelpSection>

      <ListTableHelp />
      <ImagesHelp />
      <MathHelp />
      <MermaidHelp />
      <EncodedBlocksHelp />

      <HelpLinks
        links={[
          {
            href: "https://www.markdownguide.org/cheat-sheet/",
            label: "Markdown Cheat Sheet",
          },
          { href: "https://mermaid.live/edit", label: "Mermaid Live Editor" },
        ]}
      />
    </HelpPanel>
  );
}
