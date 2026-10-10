import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { explainError } from "./errorExplainService";

const fetchMock = vi.fn();
const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  });
import { ErrorLogEntry } from "./errorLogModels";

describe("explainError", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "explain-"));
    process.env.AI_BASE_URL = "http://ai.example.edu/v1/";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_MODEL = "some-model";
    fetchMock.mockResolvedValue(reply("Line 3 is missing its points."));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(async () => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    await fs.rm(dir, { recursive: true });
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the broken file with line numbers and a sibling that parses", async () => {
    const broken = path.join(dir, "Broken.md");
    await fs.writeFile(broken, "DueAt: x\n---\n- ten pts: did it");
    await fs.writeFile(path.join(dir, "Also Broken.md"), "nope");
    await fs.writeFile(path.join(dir, "Good.md"), "good file");
    const entry: ErrorLogEntry = {
      id: "1",
      source: "Reading assignment",
      message: "Points not found",
      origin: "server",
      context: { itemType: "Assignment", itemName: "Broken", filePath: broken },
      count: 1,
      firstSeen: "",
      lastSeen: "",
      resolved: false,
    };

    const text = await explainError(entry, async (t) => t === "good file");

    expect(text).toBe("Line 3 is missing its points.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://ai.example.edu/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer test-key");
    const request = JSON.parse(init.body);
    expect(request.model).toBe("some-model");
    const prompt: string = request.messages[1].content;
    expect(prompt).toContain("   3| - ten pts: did it");
    expect(prompt).toContain("(Good.md):\ngood file");
    expect(prompt).not.toContain("nope");
  });

  it("reports the endpoint's error instead of returning empty text", async () => {
    fetchMock.mockResolvedValue(new Response("model not found", { status: 404, statusText: "Not Found" }));
    await expect(
      explainError({
        id: "1",
        source: "s",
        message: "m",
        origin: "browser",
        count: 1,
        firstSeen: "",
        lastSeen: "",
        resolved: false,
      }),
    ).rejects.toThrow("404 Not Found: model not found");
  });
});
