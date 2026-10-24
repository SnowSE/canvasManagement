const scriptTagRegex = /<script.*?<\/script>/g;
const linkTagRegex = /<link\s+rel="[^"]*"\s+href="[^"]*"[^>]*>/g;
const nonHrefAttributeRegex =
  /\s+(?!href\s*=)[\w-]+="[^"]*"|\s+(?!href\s*=)[\w-]+='[^']*'|\s+(?!href\s*=)[\w-]+=[^\s>]+/g;
const courseIdInImageUrlRegex =
  /(<img[^>]*src=")([^"]*)(\/courses\/\d+)([^"]*")/g;
const queryParametersInImageUrlRegex = /(<img[^>]*src="[^"]*)\?[^"]*"/g;
const escapedQuoteRegex = /\\"/g;
const whitespaceRegex = /\s/g;
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

  // First remove scripts and links
  let processed = withoutUnicode
    .replaceAll(scriptTagRegex, "")
    .replaceAll(linkTagRegex, "");

  // Remove all non-href attributes (including data-* attributes)
  processed = processed.replaceAll(nonHrefAttributeRegex, "");

  // Normalize image URLs by removing /courses/courseID pattern and query parameters
  processed = processed
    .replace(courseIdInImageUrlRegex, "$1$2$4")
    .replace(queryParametersInImageUrlRegex, '$1"');

  return processed
    .replaceAll(escapedQuoteRegex, '"')
    .replaceAll(whitespaceRegex, "")
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
