import { describe, expect, it } from "vitest";
import { countFenceLanguages } from "./codeFenceScan";

describe("countFenceLanguages", () => {
  it("counts each language by its own name, skipping plain and unknown blocks", () => {
    const text = [
      "```cs", "x", "```",
      "```csharp hide", "x", "```",
      "```python", "x", "```",
      "```", "x", "```",
      "```text", "x", "```",
      "```pyhton", "x", "```",
    ].join("\n");
    expect(countFenceLanguages(text)).toEqual({ csharp: 2, python: 1 });
  });

  it("adds to running counts", () => {
    expect(countFenceLanguages("```js\nx\n```", { javascript: 2 })).toEqual({ javascript: 3 });
  });
});
