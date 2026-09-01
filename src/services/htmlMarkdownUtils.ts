"use client";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import markedKatex from "marked-katex-extension";
import pako from "pako";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { CanvasLinkTargets, resolveRelativeMdHrefsForCanvas } from "./urlUtils";

// Deflated and base64url encoded, which is what mermaid.ink expects.
export function pakoDeflateBase64Url(raw: string) {
  const compressed = pako.deflate(raw, { level: 9 });
  const binaryString = Array.from(compressed, (byte) =>
    String.fromCharCode(byte)
  ).join("");
  return btoa(binaryString).replace(/\+/g, "-").replace(/\//g, "_");
}

// btoa() mangles any character above U+00FF, and course content picks those up
// easily (curly quotes and em dashes come along with anything pasted from a
// word processor), so go through TextEncoder for real utf-8 bytes first.
function utf8ToBase64(raw: string) {
  const bytes = new TextEncoder().encode(raw);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

const encoders: Record<string, (raw: string) => string> = {
  urlencoded: encodeURIComponent,
  // Plain base64 is not url-safe on its own: "+" reads as a space to a lot of
  // query string parsers, so percent-escape the result on the way into the url.
  base64: (raw) => encodeURIComponent(utf8ToBase64(raw)),
  pako: pakoDeflateBase64Url,
};

const mermaidExtension = {
  name: "mermaid",
  level: "block" as const,
  start(src: string) {
    return src.indexOf("```mermaid");
  },
  tokenizer(src: string) {
    const rule = /^```mermaid\n([\s\S]+?)```(?:\n|$)/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "mermaid",
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token: { text: string }) {
    const data = JSON.stringify({
      code: token.text,
      mermaid: { theme: "default" },
    });
    const url = `https://mermaid.ink/img/pako:${pakoDeflateBase64Url(
      data
    )}?type=svg`;
    return `<img src="${url}" alt="Mermaid diagram" />`;
  },
};

marked.use(
  markedKatex({
    throwOnError: false,
    output: "mathml",
    nonStandard: true,
  })
);

marked.use({ extensions: [mermaidExtension] });

// We use a custom renderer instead of a regex replace because regex is too aggressive.
// It would add scope="col" to raw HTML tables (which we want to leave alone).
// The renderer only applies to markdown tables.
marked.use({
  renderer: {
    tablecell(token) {
      const content = this.parser.parseInline(token.tokens);
      const { header, align } = token;
      const type = header ? "th" : "td";
      const alignAttr = align ? ` align="${align}"` : "";
      const scopeAttr = header ? ' scope="col"' : "";
      return `<${type}${scopeAttr}${alignAttr}>${content}</${type}>\n`;
    },
  },
});

// A fenced block's info line can carry two attributes after the language:
//
//   ```svg hide                  not rendered
//   ```svg encoded-name=circle   content available to {{circle:<encoding>}}
//
// The two are independent. Reading them off the info line leaves the fence
// itself for marked to tokenize, which is what makes an indented block (inside
// a list item) and a block quoted inside a wider fence behave correctly.
function parseCodeInfoLine(infoLine: string) {
  const words = infoLine.trim().split(/\s+/).filter(Boolean);
  const isAttribute = (word: string) =>
    word === "hide" || word.startsWith("encoded-name=");

  return {
    language: words.find((word) => !isAttribute(word)) ?? "",
    hide: words.includes("hide"),
    encodedName: words
      .find((word) => word.startsWith("encoded-name="))
      ?.replace("encoded-name=", ""),
  };
}

// Filled while marked renders, read by fillEncodedSlots() immediately after.
// markdownToHtmlNoImages() clears it first and nothing in between is async.
const encodedBlocks = new Map<string, string>();

marked.use({
  renderer: {
    code(token) {
      const { language, hide, encodedName } = parseCodeInfoLine(token.lang ?? "");

      if (encodedName) encodedBlocks.set(encodedName, token.text);
      if (hide) return "";

      // Returning false asks marked to render the block with its own default
      // renderer. That reads only token.lang, so narrowing lang to the bare
      // language keeps our attributes out of the language class.
      token.lang = language;
      return false;
    },
  },
});

// {{name:encoding}} as an author writes it, and the same thing after marked has
// run a link destination through encodeURI().
const ENCODED_SLOT_PATTERNS = [
  /\{\{([\w-]+):([\w-]+)\}\}/g,
  /%7B%7B([\w-]+):([\w-]+)%7D%7D/g,
];

function encodeSlot(slot: string, name: string, encoding: string) {
  const content = encodedBlocks.get(name);
  if (typeof content === "undefined") {
    // Left as written rather than thrown: {{...}}-shaped text turns up in
    // ordinary prose, and in a code block documenting this syntax.
    console.log(
      `No encoded-name=${name} block for {{${name}:${encoding}}}, leaving it as written`
    );
    return slot;
  }

  const encode = encoders[encoding];
  if (!encode) {
    throw new Error(
      `Unknown encoding "${encoding}" in {{${name}:${encoding}}} (expected one of: ${Object.keys(
        encoders
      ).join(", ")}).`
    );
  }
  return encode(content);
}

function fillEncodedSlots(html: string) {
  return ENCODED_SLOT_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, encodeSlot),
    html
  );
}

export function extractImageSources(htmlString: string) {
  const srcUrls = [];
  const regex = /<img[^>]+src=["']?([^"'>]+)["']?/g;
  let match;

  while ((match = regex.exec(htmlString)) !== null) {
    srcUrls.push(match[1]);
  }

  return srcUrls;
}

export function convertImagesToCanvasImages(
  html: string,
  settings: LocalCourseSettings
) {
  const imageSources = extractImageSources(html);
  let mutableHtml = html;
  // console.log(imageSources);

  const imageLookup = settings.assets.reduce((acc, asset) => {
    return { ...acc, [asset.sourceUrl]: asset.canvasUrl };
  }, {} as { [key: string]: string });

  for (const imageSrc of imageSources) {
    if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://"))
      continue;
    const destinationUrl = imageLookup[imageSrc];
    if (typeof destinationUrl === "undefined") {
      console.log(
        `No image in settings for ${imageSrc}, do you have NEXT_PUBLIC_ENABLE_FILE_SYNC=true in your settings?`
      );
      // leave the original src alone rather than replacing it with the
      // string "undefined", which the browser would request as a real URL
      continue;
    }
    mutableHtml = mutableHtml.replaceAll(imageSrc, destinationUrl);
  }
  return mutableHtml;
}

export function markdownToHTMLSafe({
  markdownString,
  settings,
  convertImages = true,
  replaceText = [],
  canvasLinkTargets,
}: {
  markdownString: string;
  settings: LocalCourseSettings;
  convertImages?: boolean;
  replaceText?: { source: string; destination: string; strict?: boolean }[];
  // canvas assignments/quizzes, used to resolve relative .md links to them
  canvasLinkTargets?: CanvasLinkTargets;
}) {
  const html = resolveRelativeMdHrefsForCanvas(
    markdownToHtmlNoImages(markdownString),
    settings.canvasId,
    canvasLinkTargets
  );
  const replacedHtml = replaceText.reduce(
    (acc, { source, destination, strict = false }) => {
      if (strict && acc.includes(source)) {
        if (typeof destination === "undefined" || destination === null) {
          throw new Error(
            `Text replacement failed: destination is undefined for source "${source}"`
          );
        }
        if (destination === "") {
          throw new Error(
            `Text replacement failed: destination is empty string for source "${source}"`
          );
        }
      }
      return acc.replaceAll(source, destination);
    },
    html
  );

  if (convertImages) return convertImagesToCanvasImages(replacedHtml, settings);
  return replacedHtml;
}

export function markdownToHtmlNoImages(markdownString: string) {
  encodedBlocks.clear();

  const parsedHtml = marked.parse(markdownString, {
    async: false,
    pedantic: false,
    gfm: true,
  }) as string;

  // Move caption inside table
  const htmlWithCaptionInTable = parsedHtml.replace(
    /(<caption[^>]*>[\s\S]*?<\/caption>)\s*(<table[^>]*>)/g,
    "$2$1"
  );

  // Slots are filled before sanitizing, so anything an encoded-name= block
  // splices in still goes through DOMPurify.
  const withEncodedSlots = fillEncodedSlots(htmlWithCaptionInTable);

  const clean = DOMPurify.sanitize(withEncodedSlots).replaceAll(
    />[^<>]*<\/math>/g,
    "></math>"
  );
  return clean;
}
