// A new user's pass over the app, against the walkthrough course with Canvas
// stubbed (every Canvas list is empty, so everything reads "not in Canvas").
// Each check prints PASS or FAIL; timings print as BENCH lines. Run by
// scripts/walkthrough/run.sh inside the playwright container.
import { chromium } from "playwright";
import fs from "fs/promises";

const base = process.env.BASE ?? "http://localhost:3002";
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
  await page.route("**/api/canvas/**", (r) => r.fulfill({ json: [] }));
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

{
  const { ctx, page } = await newPage();
  const t0 = Date.now();
  await page.goto(`${base}/course/Walkthrough`, { waitUntil: "load" });
  const ready = await waitFor(page, async () => (await page.locator(".draggingModule").count()) > 0 || (await page.getByText("Expand all").count()) > 0);
  bench.course_ready_ms = ready === undefined ? undefined : Date.now() - t0;
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
  for (const it of items) {
    const t0 = Date.now();
    await page.goto(`${base}/course/Walkthrough/modules/${M}/${it.kind}/${encodeURIComponent(it.name)}?panes=e,v`, { waitUntil: "load" });
    const took = await waitFor(page, async () => (await page.locator(".view-lines").first().innerText()).includes(it.text));
    if (took !== undefined) opened.push(Date.now() - t0);
    const body = await page.locator("body").innerText();
    check(`${it.name} opens in the editor`, took !== undefined);
    check(`${it.name}'s footer offers Add to Canvas`, /Add to Canvas/.test(body));
  }
  bench.item_open_ms = opened.length ? Math.round(opened.reduce((a, b) => a + b) / opened.length) : undefined;

  // a file's preview runs its script, which imports a file of another module, styled by its sibling
  await page.goto(`${base}/course/Walkthrough/modules/${M}/file/demo.html?panes=e,v`, { waitUntil: "load" });
  const frame = page.frameLocator('iframe[title="Preview of demo.html"]');
  const ran = await waitFor(page, async () => (await frame.locator("#out").innerText()) === "module says 42");
  check("a file's preview runs its script, which uses another module's file", ran !== undefined);
  const color = await frame.locator("h1").evaluate((h) => getComputedStyle(h).color).catch(() => "");
  check("a file's preview uses the stylesheet beside it", color === "rgb(0, 128, 128)", color);

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
  check("…and opens it", decodeURIComponent(page.url()).includes("/page/shape"), decodeURIComponent(page.url()));
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
