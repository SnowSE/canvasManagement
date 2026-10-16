import { describe, it, expect } from "vitest";
import { findText, textFragmentOf } from "./textFragment";

describe("textFragmentOf", () => {
  it("reads the text a #:~:text= link points at", () => {
    expect(textFragmentOf("http://x/page/Belt%20Tour#:~:text=%C2%A74.4")).toBe("§4.4");
  });

  it("keeps the start of a range and drops a prefix- and -suffix", () => {
    expect(textFragmentOf("http://x/p#:~:text=the-,quick%20fox,lazy,-dog")).toBe("quick fox");
  });

  it("is undefined without one", () => {
    expect(textFragmentOf("http://x/page/Belt%20Tour#section")).toBeUndefined();
  });
});

describe("findText", () => {
  it("finds the text itself, ignoring case", () => {
    const root = document.createElement("div");
    root.innerHTML = "<h2>§4.3 Lists</h2><h2>§4.4 Maps</h2>";

    const found = findText(root, "§4.4 maps");
    expect(found?.toString()).toBe("§4.4 Maps");
    expect(found?.startContainer.parentElement?.tagName).toBe("H2");
  });

  it("finds it partway through one long element, like a code block", () => {
    const root = document.createElement("div");
    root.innerHTML = "<pre><code>// §1\nint x;\n// §4.4 foreach\n</code></pre>";

    const found = findText(root, "§4.4");
    expect(found?.startOffset).toBe("// §1\nint x;\n// ".length);
  });

  it("is undefined when the text isn't there", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>nothing here</p>";

    expect(findText(root, "§4.4")).toBeUndefined();
  });
});
