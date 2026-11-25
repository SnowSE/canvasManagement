import { withoutNoise } from "./htmlNoise";

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

export const removeHtmlDetails = (html: string) => {
  const processed = withoutNoise(html);
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
