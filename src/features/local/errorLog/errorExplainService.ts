import fs from "fs/promises";
import path from "path";
import { ErrorLogEntry } from "./errorLogModels";

const systemPrompt = `You explain errors from Canvas Management, a web app an instructor uses to write Canvas LMS course content as markdown files on disk and publish it to Canvas.

Each assignment, quiz and page is one .md file inside a module folder (assignments/, quizzes/, pages/). The file starts with settings lines such as "DueAt: 08/29/2026 23:59:00", then a line with only "---", then the content. Quizzes list their questions after the description, with answers marked like "*a)" for correct and "b)" for incorrect. Course settings live in settings.yml. Lectures live in "00 - lectures" folders.

The reader is the instructor, not necessarily a programmer. Reply in short markdown:
1. What happened, in one or two plain sentences.
2. The most likely cause. When a file is included, point to the exact line and quote it.
3. How to fix it, as concrete steps. When the fix is an edit, show the corrected line(s) in a code block.
Say so when you are unsure, and do not invent settings the examples do not show.`;

const readIfSmall = async (filePath: string) => {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return text.length > 200_000
      ? `${text.slice(0, 200_000)}\n[file continues; only the first 200,000 characters are shown]`
      : text;
  } catch {
    return undefined;
  }
};

// The first other file in the same folder that loads, as an example of the
// format the broken file should follow.
const exampleSibling = async (
  filePath: string,
  parses: (text: string, name: string) => Promise<boolean>,
) => {
  try {
    const dir = path.dirname(filePath);
    const names = (await fs.readdir(dir)).filter(
      (n) => n.endsWith(".md") && path.join(dir, n) !== filePath,
    );
    for (const name of names) {
      const text = await readIfSmall(path.join(dir, name));
      if (text && (await parses(text, name.replace(/\.md$/, ""))))
        return { name, text };
    }
  } catch {
    // no example then
  }
  return undefined;
};

// Any OpenAI-compatible chat completions endpoint: OpenAI, OpenRouter, a local
// Ollama or LiteLLM, and so on. See .env.example.
const aiConfig = () => ({
  baseUrl: process.env.AI_BASE_URL?.replace(/\/+$/, ""),
  apiKey: process.env.AI_API_KEY,
  model: process.env.AI_MODEL,
});

export const explainServiceAvailable = () => {
  const { baseUrl, model } = aiConfig();
  return Boolean(baseUrl && model);
};

export const explainError = async (
  entry: ErrorLogEntry,
  parses?: (text: string, name: string) => Promise<boolean>,
): Promise<string> => {
  if (!explainServiceAvailable())
    throw new Error(
      "Explaining errors needs an AI endpoint. Set AI_BASE_URL and AI_MODEL (and AI_API_KEY if it needs one) in the .env file the app runs with, then restart it.",
    );

  const parts = [
    `What the app was doing: ${entry.source}`,
    `Error message:\n${entry.message}`,
    `Seen ${entry.count} time(s) this session, raised in the ${entry.origin === "browser" ? "browser" : "server"}.`,
  ];
  const { context } = entry;
  if (context?.courseName) parts.push(`Course: ${context.courseName}`);
  if (context?.moduleName) parts.push(`Module: ${context.moduleName}`);
  if (context?.itemType && context.itemName)
    parts.push(`${context.itemType}: ${context.itemName}`);

  if (context?.filePath) {
    const contents = await readIfSmall(context.filePath);
    if (contents !== undefined)
      parts.push(
        `The file (${path.basename(context.filePath)}), with line numbers:\n${contents
          .split("\n")
          .map((line, i) => `${String(i + 1).padStart(4)}| ${line}`)
          .join("\n")}`,
      );
    if (parses) {
      const example = await exampleSibling(context.filePath, parses);
      if (example)
        parts.push(
          `For comparison, a file from the same folder that loads fine (${example.name}):\n${example.text}`,
        );
    }
  }

  const { baseUrl, apiKey, model } = aiConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parts.join("\n\n") },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(
      `The AI endpoint (${baseUrl}) answered ${response.status} ${response.statusText}: ${body}`,
    );
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI endpoint returned an empty explanation.");
  return text;
};
