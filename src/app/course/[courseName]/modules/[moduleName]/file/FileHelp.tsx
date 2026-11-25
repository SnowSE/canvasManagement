"use client";
import { C, Example, HelpSection, P } from "@/components/editor/help/HelpParts";

export function FileHelp() {
  return (
    <>
      <HelpSection tags={["file"]} title="A module's files">
        <P>
          Any file in a module&apos;s <C>files</C> folder (an HTML demo, an
          SVG drawing, a stylesheet, a PDF) is listed in that module, under{" "}
          <strong>Files</strong>. A text file opens in the editor as its
          own text, coloured by its kind and saved exactly as typed, with a
          live preview; a file that isn&apos;t text (an image, a PDF) is
          previewed and never written. <strong>Empty File</strong> makes a
          new one, and <strong>Rename File</strong> renames it, in Canvas
          too.
        </P>
        <P>
          A file has no date: it is on no day of the calendar and in no
          Canvas module. What puts it in front of students is a page (or an
          assignment or quiz) that links to it. Right-click a file and
          choose <strong>Make a page for it</strong> to get that page
          written: in the file&apos;s module, named as the file is, dated
          today (drag it to its day), holding a link to the file.
        </P>
        <Example>{`
[k-koans](../files/k-koans.html)
`}</Example>
      </HelpSection>

      <HelpSection tags={["file"]} title="Files that use other files (a stylesheet, a script)">
        <P>
          A file can use other files of the course by the same relative
          address that finds them on disk: a bare name for a file in the
          same <C>files</C> folder, the path through the other module for a
          file kept once and used from several.
        </P>
        <Example>{`
<link rel="stylesheet" href="style.css">
<script type="module" src="../../01 - Intro/files/shared.js"></script>
`}</Example>
        <P>
          Nothing in the file is changed for this to work: the preview
          serves each file from its place in the course, and Canvas gets
          each one in a folder of the same place (<C>01 - Intro/files</C>),
          so an address that works with the file opened from disk works in
          both, one built by a script included. Two modules can each have a{" "}
          <C>style.css</C>. Each file is still its own: add and publish the
          ones a page uses too (adding the page says which of them Canvas
          doesn&apos;t have yet). Folders inside <C>files</C> aren&apos;t
          read, so <C>css/style.css</C> finds nothing. A file moved to
          another module reads as not in Canvas until{" "}
          <strong>Update in Canvas</strong> puts it in its new place there
          and removes the copy at the old one.
        </P>
      </HelpSection>

      <HelpSection tags={["file"]} title="A file in Canvas, and who can open it">
        <P>
          <strong>Add to Canvas</strong> uploads the file to the
          course&apos;s Canvas files, locked: Canvas shows a new upload to
          every student at once, so the app locks it straight away, and it
          stays unpublished like any new item. <strong>Publish</strong>{" "}
          unlocks it. <strong>Update in Canvas</strong> sends the file
          again after you edit it; the footer says when it has changed since
          it was sent.
        </P>
        <P>
          In Canvas a file has one lock, wherever it is used: while it is
          unpublished students can&apos;t open it from the course&apos;s
          Files or through a link in a published page, so publish the file
          as well as the page that links to it. Once
          published it is also listed in the course&apos;s Files, if
          students can see that page of the course.
        </P>
        <P>
          Canvas serves an uploaded HTML file from its own files address,
          apart from Canvas itself, so its scripts can&apos;t act as the
          student in Canvas. Keep it that way round: don&apos;t ask for
          Canvas passwords in such a page, load scripts only from places you
          trust (they run for every student who opens it), and keep nothing
          private in the browser&apos;s storage, which other uploaded pages
          may be able to read. An SVG shown as an image never runs scripts.
        </P>
      </HelpSection>
    </>
  );
}
