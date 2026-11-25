// What a Canvas copy of an item adds or changes without changing what it says,
// in one place (the sync check, htmlIsCloseEnough, starts from it).

// the theme's scripts and stylesheet links Canvas wraps around stored HTML
const scriptTagRegex = /<script.*?<\/script>/g;
const linkTagRegex = /<link\s+rel="[^"]*"\s+href="[^"]*"[^>]*>/g;
// a span only changes how text looks (the colours of highlighted code, say), never what it says
const spanTagRegex = /<\/?span\b[^>]*>/g;
// every attribute but where a link goes and what an image shows: Canvas adds and reorders the rest
const nonHrefAttributeRegex =
  /\s+(?!(?:href|src)\s*=)[\w-]+="[^"]*"|\s+(?!(?:href|src)\s*=)[\w-]+='[^']*'|\s+(?!(?:href|src)\s*=)[\w-]+=[^\s>]+/g;
// an image's address: Canvas puts its own course in front, and a query after
const courseIdInImageUrlRegex = /(<img[^>]*src=")([^"]*)(\/courses\/\d+)([^"]*")/g;
const queryParametersInImageUrlRegex = /(<img[^>]*src="[^"]*)\?[^"]*"/g;
// the key Canvas adds to a link to a course file for whoever reads the page
const queryParametersInFileLinkRegex = /(href="[^"?#]*\/files\/\d+\/download)\?[^"#]*/g;
const unicodeEscapeRegex = /\\u[\dA-Fa-f]{4}/g;

/** The HTML with everything Canvas adds or changes without changing what it says taken out. */
export const withoutNoise = (html: string) =>
  html
    .replace(unicodeEscapeRegex, (match) => String.fromCharCode(parseInt(match.slice(2), 16)))
    .replace(scriptTagRegex, "")
    .replace(linkTagRegex, "")
    .replace(spanTagRegex, "")
    .replace(nonHrefAttributeRegex, "")
    .replace(courseIdInImageUrlRegex, "$1$2$4")
    .replace(queryParametersInImageUrlRegex, '$1"')
    .replace(queryParametersInFileLinkRegex, "$1");
