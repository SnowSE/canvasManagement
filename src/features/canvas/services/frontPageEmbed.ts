/**
 * The front page with `content` inside `<div id="embed-<pageUrl>">`, or
 * undefined when it has no marker for that page. Everything outside the marker
 * is kept as written: the front page belongs to Canvas (and its editors).
 */
export const fillEmbed = (
  frontPageHtml: string,
  pageUrl: string,
  content: string,
): string | undefined => {
  const marker = new RegExp(`<div\\b[^>]*\\bid=["']embed-${escape(pageUrl)}["'][^>]*>`);
  const open = marker.exec(frontPageHtml);
  if (!open) return undefined;

  const start = open.index + open[0].length;
  const end = closingDivAt(frontPageHtml, start);
  if (end === undefined) return undefined;
  return frontPageHtml.slice(0, start) + content + frontPageHtml.slice(end);
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where the `</div>` closing an already open div starts. */
const closingDivAt = (html: string, from: number) => {
  const divTags = /<div\b[^>]*>|<\/div\s*>/g;
  divTags.lastIndex = from;
  let depth = 1;
  for (let tag = divTags.exec(html); tag; tag = divTags.exec(html)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return tag.index;
  }
  return undefined;
};
