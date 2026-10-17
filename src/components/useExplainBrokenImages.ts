import { RefObject, useEffect } from "react";
import { useTRPCClient } from "@/services/serverFunctions/trpcClient";
import { isLocalImageSource } from "@/services/imageSources";
import type { ImageDiagnosis } from "@/features/canvas/services/files/publicImageFiles";

const element = (tag: string, className: string, text?: string) => {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
};

// built with textContent, never innerHTML: src and file names come from files
const brokenImageNotice = (src: string, diagnosis: ImageDiagnosis | undefined) => {
  const box = element(
    "div",
    "broken-image-notice my-2 rounded-md border border-amber-500/60 bg-amber-950/40 p-2 text-sm text-amber-100",
  );
  const title = element("div", "font-bold text-amber-300", "Image not found: ");
  title.appendChild(element("code", "", src));
  box.appendChild(title);
  if (!diagnosis) {
    box.appendChild(
      element("div", "", "The browser could not load it, and the server could not say why."),
    );
    return box;
  }
  if (diagnosis.found) {
    box.appendChild(
      element(
        "div",
        "",
        `The file is there (${diagnosis.lookedFor}), but the browser could not show it. Is it an image? Try opening it from the link below.`,
      ),
    );
    const link = element("a", "underline", src) as HTMLAnchorElement;
    link.href = src;
    link.target = "_blank";
    box.appendChild(link);
    return box;
  }
  if (diagnosis.problem) box.appendChild(element("div", "", diagnosis.problem));
  if (diagnosis.suggestions.length > 0) {
    const line = element("div", "", "Did you mean ");
    diagnosis.suggestions.forEach((suggestion, i) => {
      if (i > 0) line.appendChild(document.createTextNode(" or "));
      line.appendChild(element("code", "", suggestion));
    });
    line.appendChild(document.createTextNode("?"));
    box.appendChild(line);
  }
  if (diagnosis.lookedFor)
    box.appendChild(
      element("div", "text-xs text-amber-200/70", `Looked for ${diagnosis.lookedFor} in the container.`),
    );
  return box;
};

// ![alt](path with a space.png) is not an image to markdown, since a raw space
// ends the link: it is left in the page as text. Finds that text outside code.
const unparsedImage =
  /!\[([^\]]*)\]\(((?:[^()\n]|\([^()\n]*\))*\s(?:[^()\n]|\([^()\n]*\))*)\)/;

const unparsedImageNotice = (text: string, alt: string, target: string) => {
  const box = element(
    "div",
    "broken-image-notice my-2 rounded-md border border-amber-500/60 bg-amber-950/40 p-2 text-sm text-amber-100",
  );
  const title = element("div", "font-bold text-amber-300", "Not shown as an image: ");
  title.appendChild(element("code", "", text));
  box.appendChild(title);
  box.appendChild(
    element(
      "div",
      "",
      "The path has a space in it, and a space ends a markdown link. Write each space as %20:",
    ),
  );
  box.appendChild(element("code", "", `![${alt}](${target.trim().replace(/\s/g, "%20")})`));
  return box;
};

const explainUnparsedImages = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("code, pre, .broken-image-notice")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const found: Text[] = [];
  while (walker.nextNode()) {
    if (unparsedImage.test(walker.currentNode.textContent ?? ""))
      found.push(walker.currentNode as Text);
  }
  for (let node of found) {
    let match = unparsedImage.exec(node.textContent ?? "");
    while (match) {
      const start = node.splitText(match.index);
      const rest = start.splitText(match[0].length);
      start.replaceWith(unparsedImageNotice(match[0], match[1], match[2]));
      node = rest;
      match = unparsedImage.exec(node.textContent ?? "");
    }
  }
};

/**
 * Replaces each local image in the rendered html that fails to load with a
 * note saying why: wrong letter case, a close file name, a missing
 * /images/facultyFiles/ prefix, or a faculty files folder that is not mounted.
 * Image markdown left as text because of a space in its path is explained too.
 */
export const useExplainBrokenImages = (
  ref: RefObject<HTMLElement | null>,
  html: string,
) => {
  const trpcClient = useTRPCClient();
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    explainUnparsedImages(root);

    // failed: the error event fired; otherwise it only looked broken (an svg
    // with no size of its own also reports a natural width of 0)
    const explain = async (img: HTMLImageElement, failed: boolean) => {
      if (img.dataset.explained) return;
      img.dataset.explained = "true";
      const src = img.getAttribute("src") ?? "";
      const diagnosis = await trpcClient.canvasFile.diagnoseImage
        .query({ src })
        .catch(() => undefined);
      if (cancelled || !img.isConnected) return;
      if (diagnosis?.found && !failed) {
        delete img.dataset.explained;
        return;
      }
      img.replaceWith(brokenImageNotice(src, diagnosis));
    };

    const images = [...root.querySelectorAll("img")].filter((img) =>
      isLocalImageSource(img.getAttribute("src") ?? ""),
    );
    const stopListening = images.map((img) => {
      const onError = () => explain(img, true);
      img.addEventListener("error", onError);
      // it may have failed before this effect ran
      if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) explain(img, false);
      return () => img.removeEventListener("error", onError);
    });
    return () => {
      cancelled = true;
      stopListening.forEach((stop) => stop());
    };
  }, [ref, html, trpcClient]);
};
