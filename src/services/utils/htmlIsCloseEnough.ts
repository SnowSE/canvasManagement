const scriptTagRegex = /<script.*?<\/script>/g;
const linkTagRegex = /<link\s+rel="[^"]*"\s+href="[^"]*"[^>]*>/g;
// every attribute but where a link goes and what an image shows: Canvas adds and reorders the rest
const nonHrefAttributeRegex =
  /\s+(?!(?:href|src)\s*=)[\w-]+="[^"]*"|\s+(?!(?:href|src)\s*=)[\w-]+='[^']*'|\s+(?!(?:href|src)\s*=)[\w-]+=[^\s>]+/g;
const courseIdInImageUrlRegex =
  /(<img[^>]*src=")([^"]*)(\/courses\/\d+)([^"]*")/g;
const queryParametersInImageUrlRegex = /(<img[^>]*src="[^"]*)\?[^"]*"/g;
// the key Canvas adds to a link to a course file for whoever reads the page
const queryParametersInFileLinkRegex = /(href="[^"?#]*\/files\/\d+\/download)\?[^"#]*/g;
// a span only changes how text looks (the colours of highlighted code, say), never what it says
const spanTagRegex = /<\/?span\b[^>]*>/g;
const escapedQuoteRegex = /\\"/g;
// whitespace counts as one separator wherever it shows, but none beside a block
// tag (a paragraph, a list, a code block), where it only lays the HTML out
const whitespaceRunRegex = /(\s|&nbsp;)+/g;
const besideBlockTagRegex = / ?(<\/?(?:p|div|pre|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|blockquote|br|hr|figure|figcaption|caption|section)\b[^>]*>) ?/g;
const hrTagRegex = /<hr\s*\/?>/g;
const brTagRegex = /<br\s*\/?>/g;
const htmlGreaterThanRegex = /&gt;/g;
const htmlLessThanRegex = /&lt;/g;
const greaterThanRegex = />/g;
const lessThanRegex = /</g;
const htmlQuoteRegex = /&quot;/g;
const quoteRegex = /"/g;
const htmlAmpersandRegex = /&amp;/g;
const ampersandRegex = /&/g;
const unicodeEscapeRegex = /\\u[\dA-Fa-f]{4}/g;

function replaceUnicodeEscapes(input: string) {
  return input.replace(unicodeEscapeRegex, (match) => {
    // Extract the hexadecimal part and convert it to a character
    return String.fromCharCode(parseInt(match.slice(2), 16));
  });
}

export const removeHtmlDetails = (html: string) => {
  const withoutUnicode = replaceUnicodeEscapes(html);

  // First remove scripts, links and spans
  let processed = withoutUnicode
    .replaceAll(scriptTagRegex, "")
    .replaceAll(linkTagRegex, "")
    .replaceAll(spanTagRegex, "");

  // Remove every attribute but href and src (data-* attributes included)
  processed = processed.replaceAll(nonHrefAttributeRegex, "");

  // Normalize image URLs by removing /courses/courseID pattern and query parameters
  processed = processed
    .replace(courseIdInImageUrlRegex, "$1$2$4")
    .replace(queryParametersInImageUrlRegex, '$1"')
    .replace(queryParametersInFileLinkRegex, "$1");

  return processed
    .replaceAll(escapedQuoteRegex, '"')
    .replaceAll(whitespaceRunRegex, " ")
    .replaceAll(besideBlockTagRegex, "$1")
    .trim()
    .replaceAll(hrTagRegex, "<hr>")
    .replaceAll(brTagRegex, "<br>")
    .replaceAll(htmlGreaterThanRegex, "")
    .replaceAll(htmlLessThanRegex, "")
    .replaceAll(greaterThanRegex, "")
    .replaceAll(lessThanRegex, "")
    .replaceAll(htmlQuoteRegex, "")
    .replaceAll(quoteRegex, "")
    .replaceAll(htmlAmpersandRegex, "")
    .replaceAll(ampersandRegex, "");
};

export const htmlIsCloseEnough = (html1: string, html2: string) => {
  return removeHtmlDetails(html1) === removeHtmlDetails(html2);
};
