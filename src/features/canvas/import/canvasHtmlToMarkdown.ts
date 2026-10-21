import TurndownService from "turndown";
import { baseCanvasUrl } from "@/services/urlUtils";

/**
 * Canvas links and images are often relative ("/courses/1/files/2/preview"),
 * which only resolve inside Canvas; make them absolute so the preview here
 * shows them too.
 */
const absoluteCanvasUrl = (url: string | null) =>
  url && url.startsWith("/") && !url.startsWith("//")
    ? baseCanvasUrl + url
    : (url ?? "");

function createTurndown(bulletListMarker: "-" | "*") {
  const turndown = new TurndownService({
    // a setext "---" underline would end a file's settings section
    headingStyle: "atx",
    hr: "* * *",
    codeBlockStyle: "fenced",
    bulletListMarker,
    emDelimiter: "_",
  });

  // markdown has no tables of its own here, and embeds have no markdown at
  // all, so they stay HTML (marked passes HTML blocks through)
  turndown.keep(["table", "iframe", "video", "audio", "sub", "sup"]);
  // the Canvas theme adds its stylesheet and script to every description
  turndown.remove(["script", "style", "link"]);

  // math this app published: back to its LaTeX when KaTeX kept it, else the
  // rendered math stays as it is
  turndown.addRule("katex", {
    filter: (node) =>
      node.nodeName === "SPAN" && (node as HTMLElement).classList.contains("katex"),
    replacement: (_content, node) => {
      const element = node as HTMLElement;
      const latex = element.querySelector(
        'annotation[encoding="application/x-tex"]',
      )?.textContent;
      return latex ? `$${latex.trim()}$` : element.outerHTML;
    },
  });

  turndown.addRule("canvasLink", {
    filter: (node) => node.nodeName === "A" && !!node.getAttribute("href"),
    replacement: (content, node) => {
      const element = node as HTMLElement;
      const href = absoluteCanvasUrl(element.getAttribute("href"));
      const title = element.getAttribute("title");
      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
      return content.trim() ? `[${content}](${href}${titlePart})` : "";
    },
  });

  turndown.addRule("canvasImage", {
    filter: "img",
    replacement: (_content, node) => {
      const element = node as HTMLElement;
      // the Canvas equation editor saves LaTeX as an image of it
      const latex = element.getAttribute("data-equation-content");
      if (latex) return `$${latex.trim()}$`;
      const src = absoluteCanvasUrl(element.getAttribute("src"));
      if (!src) return "";
      const alt = (element.getAttribute("alt") ?? "").replace(/[[\]]/g, "");
      return `![${alt}](${src})`;
    },
  });

  return turndown;
}

const turndowns = {
  "-": createTurndown("-"),
  "*": createTurndown("*"),
};

/**
 * Canvas HTML as markdown for a course file. Quiz question text uses "*"
 * bullets because a line starting with "-" or "+" in a question is feedback.
 */
export function canvasHtmlToMarkdown(
  html: string | null | undefined,
  { bulletListMarker = "-" }: { bulletListMarker?: "-" | "*" } = {},
): string {
  if (!html || !html.trim()) return "";
  return (
    turndowns[bulletListMarker]
      .turndown(html)
      // empty "<p>&nbsp;</p>" spacer paragraphs
      .split("\n")
      .map((line) => (line.replace(/\u00a0/g, " ").trim() === "" ? "" : line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Plain text from Canvas (answer text, feedback): no tags, no entities. */
export function canvasHtmlToPlainText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .trim();
}
