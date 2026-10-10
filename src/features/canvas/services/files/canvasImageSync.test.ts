import { describe, expect, it } from "vitest";
import { localPathForImage } from "./canvasImageSync";
import { isLocalImageSource } from "@/services/imageSources";
import { localImageSourcesInMarkdown } from "@/features/canvas/hooks/usePrepareImagesForCanvas";

describe("image sources", () => {
  it("treats web, data and protocol-relative urls as not local", () => {
    expect(isLocalImageSource("https://mermaid.ink/img/pako:abc?type=svg")).toBe(false);
    expect(isLocalImageSource("http://example.edu/a.png")).toBe(false);
    expect(isLocalImageSource("//cdn.example.edu/a.png")).toBe(false);
    expect(isLocalImageSource("data:image/png;base64,AAAA")).toBe(false);
    expect(isLocalImageSource("/images/facultyFiles/a.png")).toBe(true);
    expect(isLocalImageSource("images/a.png")).toBe(true);
  });

  it("finds only local images in markdown, mermaid diagrams excluded", () => {
    const sources = localImageSourcesInMarkdown([
      "![diagram](/images/a.png)\n\n![web](https://example.edu/b.png)",
      "```mermaid\ngraph LR\n  A --> B\n```\n\n![again](/images/a.png)",
    ]);
    expect(sources).toEqual(["/images/a.png"]);
  });

  it("resolves paths under the public folder and refuses to leave it", () => {
    expect(localPathForImage("/images/a.png", "/app/public")).toBe("/app/public/images/a.png");
    expect(localPathForImage("./images/a%20b.png", "/app/public")).toBe("/app/public/images/a b.png");
    expect(localPathForImage("images/a.png", "/app/public")).toBe("/app/public/images/a.png");
    expect(localPathForImage("/../../etc/passwd", "/app/public")).toBeUndefined();
  });
});
