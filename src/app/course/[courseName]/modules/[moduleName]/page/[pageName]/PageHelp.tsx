"use client";
import {
  C,
  Example,
  HelpSection,
  P,
} from "@/components/editor/help/HelpParts";

export function PageHelp() {
  return (
    <>
      <HelpSection tags={["page"]} title="File layout">
        <P>
          Settings, then a <C>---</C> line, then the page in markdown.{" "}
          <C>DateForOrdering</C> (or its older name <C>DueDateForOrdering</C>)
          only decides where the page sits on the calendar and in its module.
        </P>
        <Example>{`
DateForOrdering: 08/26/2026 23:59:00
---

# Course schedule

What students should read, in markdown.
`}</Example>
        <P>
          <C>AddToHome: true</C> (optional) puts the page on the course home
          page each time you update it: in its marker{" "}
          <C>{'<div id="embed-<page address>"></div>'}</C> if the home page
          has one, otherwise at the end. <C>AddToHome: false</C> empties that
          spot. <strong>View home in Canvas</strong> in the footer&apos;s ⋯ menu
          opens the home page to see it there.
        </P>
        <Example>{`
DateForOrdering: 08/26/2026 23:59:00
AddToHome: true
---
`}</Example>
      </HelpSection>

      <HelpSection tags={["page"]} title="Links to other course files">
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
    </>
  );
}
