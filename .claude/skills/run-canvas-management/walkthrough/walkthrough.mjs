// A new user's pass over the app, against the walkthrough course and a fake
// Canvas holding its course in memory (fakeCanvas.mjs): every item starts
// not in Canvas, and is added and published there along the way.
// Each check prints PASS or FAIL; timings print as BENCH lines. Run by
// run.sh beside it, inside the playwright container.
import { chromium } from "playwright";
import fs from "fs/promises";

// where the app and the fake Canvas are: run.sh says, having picked free ports
const { BASE: base, FAKE: fake } = process.env;
if (!base || !fake) throw new Error("BASE and FAKE (the app's and the fake Canvas's addresses) are set by run.sh");
const canvas = async (what) => (await fetch(`${fake}/${what}`)).json();
// the Canvas requests since the last call: on a real course each is a round trip
const canvasRequests = async () => (await canvas("__requests")).length;
const course = process.env.COURSE_DIR ?? "/course/Walkthrough"; // the served copy, to read what the app wrote
const results = [];
const bench = {};
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

const browser = await chromium.launch();
const errors = [];
const newPage = async (width = 1500) => {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: "America/Denver" });
  const page = await ctx.newPage();
  // a stale render on the first load is expected noise (see the run skill)
  page.on("pageerror", (e) => !/Hydration failed/.test(String(e)) && errors.push(String(e).slice(0, 200)));
  return { ctx, page };
};
const waitFor = async (page, test, timeout = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await test().catch(() => false)) return Date.now() - start;
    await page.waitForTimeout(100);
  }
  return undefined;
};
const M = "02%20-%20Basics";
const items = [
  { kind: "assignment", name: "Lab 1", icon: "Assignment", text: "DueAt", menu: ["Add to Canvas", "Duplicate", "Rename"] },
  { kind: "quiz", name: "Quiz 1", icon: "Quiz", text: "ShuffleAnswers", menu: ["Add to Canvas", "Duplicate", "Rename"] },
  { kind: "page", name: "Day 2", icon: "Page", text: "DateForOrdering", menu: ["Add to Canvas", "Duplicate", "Rename"] },
  { kind: "file", name: "demo.html", icon: "File", text: "<!doctype", menu: ["Add to Canvas", "Make a page for it"] },
];
const shape = { kind: "file", name: "shape.svg" };

{
  const { ctx, page } = await newPage();
  const t0 = Date.now();
  await canvasRequests();
  await page.goto(`${base}/course/Walkthrough`, { waitUntil: "load" });
  const ready = await waitFor(page, async () => (await page.locator(".draggingModule").count()) > 0 || (await page.getByText("Expand all").count()) > 0);
  bench.course_ready_ms = ready === undefined ? undefined : Date.now() - t0;
  // what the page asks Canvas for once it has settled
  await page.waitForTimeout(3000);
  bench.course_page_canvas_requests = await canvasRequests();
  check("the course page opens", ready !== undefined);
  const show = page.locator('[aria-label="Show Modules"]').last();
  if (await show.count()) await show.click();
  await page.getByText("Expand all").first().click().catch(() => {});
  await page.waitForTimeout(1500);
  for (const it of items) {
    const row = page.locator(".draggingModule a[role='button']", { hasText: it.name }).first();
    const icon = await row.locator("svg[aria-label]").first().getAttribute("aria-label").catch(() => "none");
    check(`the module list shows ${it.name} as ${it.icon.toLowerCase()}`, icon === it.icon, icon);
    await row.click({ button: "right" }).catch(() => {});
    await page.waitForTimeout(800);
    const menu = await page.evaluate(() => [...document.querySelectorAll("div.fixed.inset-0 button, div.fixed.inset-0 a")].map((b) => b.innerText.trim()));
    const missing = it.menu.filter((m) => !menu.some((t) => t.startsWith(m)));
    check(`${it.name}'s right-click menu has ${it.menu.join(", ")}`, missing.length === 0, missing.length ? `missing ${missing.join(", ")}; has ${menu.join(", ")}` : "");
    await page.keyboard.press("Escape");
    await page.mouse.click(1450, 40);
    await page.waitForTimeout(300);
  }
  await ctx.close();
}

{
  const { ctx, page } = await newPage();
  const opened = [];
  const openRequests = [];
  for (const it of items) {
    await canvasRequests();
    const t0 = Date.now();
    await page.goto(`${base}/course/Walkthrough/modules/${M}/${it.kind}/${encodeURIComponent(it.name)}?panes=e,v`, { waitUntil: "load" });
    const took = await waitFor(page, async () => (await page.locator(".view-lines").first().innerText()).includes(it.text));
    if (took !== undefined) opened.push(Date.now() - t0);
    await page.waitForTimeout(1500);
    openRequests.push(await canvasRequests());
    const body = await page.locator("body").innerText();
    check(`${it.name} opens in the editor`, took !== undefined);
    check(`${it.name}'s footer offers Add to Canvas`, /Add to Canvas/.test(body));
  }
  bench.item_open_ms = opened.length ? Math.round(opened.reduce((a, b) => a + b) / opened.length) : undefined;
  bench.item_open_canvas_requests = Math.round(openRequests.reduce((a, b) => a + b, 0) / openRequests.length);

  // a file's preview runs its script, which imports a file of another module, styled by its sibling
  await page.goto(`${base}/course/Walkthrough/modules/${M}/file/demo.html?panes=e,v`, { waitUntil: "load" });
  const frame = page.frameLocator('iframe[title="Preview of demo.html"]');
  const ran = await waitFor(page, async () => (await frame.locator("#out").innerText()) === "module says 42");
  check("a file's preview runs its script, which uses another module's file", ran !== undefined);
  const color = await frame.locator("h1").evaluate((h) => getComputedStyle(h).color).catch(() => "");
  check("a file's preview uses the stylesheet beside it", color === "rgb(0, 128, 128)", color);

  // a code block whose fence names a known language is coloured
  await page.goto(`${base}/course/Walkthrough/modules/${M}/page/Day%202?panes=e,v`, { waitUntil: "load" });
  const coloured = await waitFor(page, async () => (await page.locator(".markdownPreview pre span[style*='color']").count()) > 0);
  check("a code block in a known language is coloured in the preview", coloured !== undefined);

  // typing is saved to the file
  await page.goto(`${base}/course/Walkthrough/modules/${M}/page/Day%202?panes=e,v`, { waitUntil: "load" });
  await waitFor(page, async () => (await page.locator(".view-lines").first().innerText()).includes("Day 2"));
  await page.locator(".monaco-editor textarea, .monaco-editor .native-edit-context").first().focus();
  await page.keyboard.press("Control+End");
  const t0 = Date.now();
  await page.keyboard.type(" walkthrough");
  const saved = await waitFor(page, async () => (await fs.readFile(`${course}/02 - Basics/pages/Day 2.md`, "utf-8")).includes("walkthrough"));
  bench.save_after_typing_ms = saved === undefined ? undefined : Date.now() - t0;
  check("what is typed is saved to the file", saved !== undefined);
  await ctx.close();
}

{
  // Make a page for it: a page in the file's module that links to the file
  const { ctx, page } = await newPage();
  await page.goto(`${base}/course/Walkthrough?panes=m`, { waitUntil: "load" });
  await waitFor(page, async () => (await page.getByText("Expand all").count()) > 0);
  await page.getByText("Expand all").first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator(".draggingModule a[role='button']", { hasText: "shape.svg" }).first().click({ button: "right" }).catch(() => {});
  await page.getByText("Make a page for it").click().catch(() => {});
  const made = await waitFor(page, async () => (await fs.readFile(`${course}/02 - Basics/pages/shape.md`, "utf-8")).includes("](../files/shape.svg)"));
  check("Make a page for it writes a page that links to the file", made !== undefined);
  const openedPage = await waitFor(page, async () => decodeURIComponent(page.url()).includes("/page/shape"));
  check("…and opens it", openedPage !== undefined, decodeURIComponent(page.url()));
  await ctx.close();
}

{
  // Into Canvas: each kind added and published from its footer, then in sync.
  // The files first: the page links to one and shows the other, and a page using a file Canvas lacks is refused.
  const { ctx, page } = await newPage();
  const toasts = [];
  const footer = async () => {
    const lines = (await page.locator("body").innerText()).split("\n").filter((l) => /Canvas|Publish|sync|differ/i.test(l)).slice(-6).join(" | ");
    // what differs, as the Compare pane lists it, and what the app said in its toasts
    const compare = await page.evaluate(() => [...document.querySelectorAll("tr")].filter((tr) => tr.querySelector(".bg-rose-500")).map((tr) => tr.innerText.replace(/\s+/g, " ").slice(0, 160)));
    return [lines, ...compare, ...toasts.splice(0)].join(" || ");
  };
  page.on("console", (m) => /error|fail/i.test(m.text()) && toasts.push("console: " + m.text().slice(0, 200)));
  const clickFooter = async (label) => {
    const button = page.locator("button", { hasText: label }).last();
    if (!(await button.count())) return false;
    await button.click();
    return true;
  };
  const sendRequests = [];
  for (const it of [items[3], shape, items[0], items[1], items[2]]) {
    await page.goto(`${base}/course/Walkthrough/modules/${M}/${it.kind}/${encodeURIComponent(it.name)}?panes=e,d`, { waitUntil: "load" });
    await waitFor(page, async () => /Add to Canvas/.test(await page.locator("body").innerText()));
    await page.waitForTimeout(1500);
    await canvasRequests();
    await clickFooter("Add to Canvas");
    await page.waitForTimeout(1500);
    const said = await page.locator('[role="status"]').allInnerTexts().catch(() => []);
    toasts.push(...said.map((t) => "toast: " + t.slice(0, 200)));
    const added = await waitFor(page, async () => /Publish in Canvas/.test(await page.locator("body").innerText()), 20000);
    check(`${it.name} is added to Canvas from its footer`, added !== undefined, await footer());
    page.once("dialog", (d) => d.accept());
    await clickFooter("Publish in Canvas");
    const published = await waitFor(page, async () => /In sync · Published/.test(await page.locator("body").innerText()), 20000);
    check(`${it.name} is published, and its footer then reads in sync and published`, published !== undefined, await footer());
    sendRequests.push(await canvasRequests());
  }
  bench.add_and_publish_canvas_requests = Math.round(sendRequests.reduce((a, b) => a + b, 0) / sendRequests.length);
  const held = await canvas("__state");
  check("Canvas has the assignment, the quiz with its 2 questions, the page and the file, each published", held.assignments.some((a) => a.name === "Lab 1" && a.published) && held.quizzes.some((q) => q.title === "Quiz 1" && q.published && (held.questions[q.id] ?? []).length === 2) && held.pages.some((p) => p.title === "Day 2" && p.published) && held.files.some((f) => f.display_name === "demo.html" && !f.locked), JSON.stringify({ assignments: held.assignments.map((a) => [a.name, a.published]), quizzes: held.quizzes.map((q) => [q.title, q.published, (held.questions[q.id] ?? []).length]), pages: held.pages.map((p) => [p.title, p.published]), files: held.files.map((f) => [f.display_name, f.locked]) }));
  const page2 = held.pages.find((p) => p.title === "Day 2");
  const fileId = held.files.find((f) => f.display_name === "demo.html")?.id;
  check("the page's link points at the file's copy in Canvas", page2?.body?.includes(`/files/${fileId}/download`), page2?.body?.slice(0, 200));

  // the module list says the same as each footer: in sync
  await page.goto(`${base}/course/Walkthrough?panes=m`, { waitUntil: "load" });
  await waitFor(page, async () => (await page.getByText("Expand all").count()) > 0);
  await page.getByText("Expand all").first().click().catch(() => {});
  await page.waitForTimeout(3000);
  const bar = (await page.locator("body").innerText()).match(/\d+ (Not In Canvas|Needs Sync|Unpublished)/g) ?? [];
  check("the module list then shows nothing needing sync or publishing for them", !bar.some((b) => /Needs Sync|Unpublished/.test(b)), bar.join(", "));
  const unknownCalls = await canvas("__unknown");
  check("the app asked Canvas only for what the fake Canvas knows", unknownCalls.length === 0, [...new Set(unknownCalls)].slice(0, 6).join("; "));
  await ctx.close();
}

{
  // Compare with Canvas, one question at a time: an edit in the file is sent alone with its →, and ← pulls Canvas's back
  const { ctx, page } = await newPage();
  const quizFile = `${course}/02 - Basics/quizzes/Quiz 1.md`;
  const original = await fs.readFile(quizFile, "utf-8");
  const canvasQuestion1 = async () => {
    const held = await canvas("__state");
    const quiz = held.quizzes.find((q) => q.title === "Quiz 1");
    return [...(held.questions[quiz.id] ?? [])].sort((a, b) => a.position - b.position)[0]?.question_text ?? "";
  };
  const differingRows = () => page.evaluate(() => [...document.querySelectorAll("tr")].filter((tr) => tr.querySelector(".bg-rose-500")).map((tr) => tr.innerText.replace(/\s+/g, " ").slice(0, 60)));
  const move = async (label) => {
    await page.getByRole("button", { name: label }).first().click();
    await page.locator("div.fixed.inset-0 button", { hasText: /^Replace/ }).first().click();
  };
  const openCompare = async () => {
    await page.goto(`${base}/course/Walkthrough/modules/${M}/quiz/Quiz%201?panes=d`, { waitUntil: "load" });
    await waitFor(page, async () => /Settings and questions/.test(await page.locator("body").innerText()));
  };

  await fs.writeFile(quizFile, original.replace("What is 2 + 4?", "What is 3 + 3?"));
  await openCompare();
  const differs = await waitFor(page, async () => (await differingRows()).some((r) => /Question 1/.test(r)));
  check("an edited question shows as differing in Compare with Canvas, with arrows beside its dot", differs !== undefined && (await page.getByRole("button", { name: "Send Question 1 · multiple choice to Canvas" }).count()) === 1, (await differingRows()).join(" | "));
  check("there is no Send all to Canvas: Update in Canvas, in the footer, does that", (await page.getByText("Send all to Canvas").count()) === 0);
  await move("Send Question 1 · multiple choice to Canvas").catch((e) => check("…the question's → sends it", false, e.message.slice(0, 120)));
  const sent = await waitFor(page, async () => (await canvasQuestion1()).includes("3 + 3"), 20000);
  check("→ sends that question alone to Canvas", sent !== undefined, await canvasQuestion1());
  const insync = await waitFor(page, async () => !(await differingRows()).some((r) => /Question/.test(r)), 20000);
  check("…after which Compare with Canvas shows the questions in sync", insync !== undefined, (await differingRows()).join(" | "));

  await fs.writeFile(quizFile, (await fs.readFile(quizFile, "utf-8")).replace("What is 3 + 3?", "What is 1 + 5?"));
  await openCompare();
  await waitFor(page, async () => (await differingRows()).some((r) => /Question 1/.test(r)));
  await move("Pull Question 1 · multiple choice from Canvas").catch((e) => check("…the question's ← pulls it", false, e.message.slice(0, 120)));
  const pulled = await waitFor(page, async () => (await fs.readFile(quizFile, "utf-8")).includes("What is 3 + 3?"), 20000);
  check("← pulls Canvas's version of that question into the file, the rest left as they were", pulled !== undefined && (await fs.readFile(quizFile, "utf-8")).includes("Describe one thing you learned this week."), (await fs.readFile(quizFile, "utf-8")).split("---")[1]?.slice(0, 120));
  await ctx.close();
}

{
  // a small window still fits the item's editor and preview beside the modules
  const { ctx, page } = await newPage(800);
  await page.goto(`${base}/course/Walkthrough/modules/${M}/page/Day%202?panes=m,e,v`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  const open = await page.evaluate(() => [...new Set([...document.querySelectorAll("[aria-label^='Collapse ']")].map((b) => b.getAttribute("aria-label").replace("Collapse ", "")))]);
  check("an 800 px window fits Modules, Editor and Preview", ["Modules", "Editor", "Preview"].every((p) => open.includes(p)), open.join(", "));
  await ctx.close();
}

check("no errors on the page", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail && !r.ok ? `  (${r.detail})` : ""}`);
for (const [k, v] of Object.entries(bench)) console.log(`BENCH ${k} ${v ?? "n/a"}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
