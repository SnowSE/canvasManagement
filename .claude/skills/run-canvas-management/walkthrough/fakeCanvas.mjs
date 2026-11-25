// A fake Canvas for the walkthrough: one course, held in memory, answering
// the parts of the Canvas REST API the app uses, the way Canvas does as far
// as the app can tell (ids, a page's url from its title, unpublished on
// creation, uploads in two steps). Anything else is answered 404 and listed
// at GET /__unknown, so a walkthrough can say what the app asked for that
// this fake doesn't know. GET /__state shows everything it holds. GET
// /__requests says how many Canvas requests came since the last time it was
// asked: on a real course each is a round trip to Canvas, so the count matters
// as much as the time.
//
//   node fakeCanvas.mjs <port> [host]      (the app: CANVAS_FAKE_URL=http://127.0.0.1:<port>)
import http from "node:http";

const port = Number(process.argv[2]);
if (!port) throw new Error("usage: node fakeCanvas.mjs <port> [host]");
// inside the walkthrough's container it listens on every address, for the port docker publishes (on 127.0.0.1 only)
const host = process.argv[3] ?? "127.0.0.1";
const self = `http://127.0.0.1:${port}`;
let nextId = 1000;
const id = () => nextId++;

const state = {
  course: { id: 1, name: "Walkthrough", course_code: "WALK", workflow_state: "available" },
  assignments: [],
  assignmentGroups: [{ id: 1, name: "Assignments", position: 1, group_weight: 0 }],
  quizzes: [],
  questions: {}, // by quiz id
  quizGroups: {}, // by quiz id
  pages: [],
  frontPage: undefined,
  modules: [],
  files: [],
  folders: [{ id: 1, name: "course files", full_name: "course files", parent_folder_id: null }],
  uploads: {},
};
const unknown = [];
let requests = [];

const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const unwrap = (body, key) => (body && typeof body[key] === "object" ? body[key] : body ?? {});
const byId = (list, value) => list.find((x) => String(x.id) === String(value));

/** A folder of the course's files by its path below "course files", made with its parents if it isn't there. */
function folderAt(path) {
  let parent = state.folders[0];
  for (const name of (path ?? "").split("/").filter(Boolean)) {
    const fullName = `${parent.full_name}/${name}`;
    parent = state.folders.find((f) => f.full_name === fullName) ?? (state.folders.push({ id: id(), name, full_name: fullName, parent_folder_id: parent.id }), state.folders.at(-1));
  }
  return parent;
}

const itemPublished = (item) => {
  const content =
    item.type === "Page" ? state.pages.find((p) => p.url === item.page_url) : item.type === "Quiz" ? byId(state.quizzes, item.content_id) : item.type === "File" ? byId(state.files, item.content_id) : byId(state.assignments, item.content_id);
  return item.type === "File" ? !content?.locked : !!content?.published;
};
const moduleOut = (m, withItems) => ({ ...m, items_count: m.items.length, ...(withItems ? { items: m.items.map((i) => ({ ...i, published: itemPublished(i) })) } : { items: undefined }) });

/** The routes, matched in order against the path below /api/v1: [method, pattern, handler(params, body, query)]. */
const routes = [
  ["GET", /^courses$/, () => [state.course]],
  ["GET", /^courses\/1$/, () => state.course],
  ["GET", /^accounts\/\d+\/terms$/, () => ({ enrollment_terms: [] })],
  ["GET", /^courses\/1\/(users|group_categories|tabs)$/, () => []],

  ["GET", /^courses\/1\/assignment_groups$/, (_, __, q) => state.assignmentGroups.map((g) => ({ ...g, ...(q.includes("assignments") && { assignments: state.assignments.filter((a) => a.assignment_group_id === g.id) }) }))],
  ["POST", /^courses\/1\/assignment_groups$/, (_, b) => (state.assignmentGroups.push({ id: id(), position: state.assignmentGroups.length + 1, group_weight: 0, ...b }), state.assignmentGroups.at(-1))],
  ["PUT", /^courses\/1\/assignment_groups\/(\d+)$/, ([g], b) => Object.assign(byId(state.assignmentGroups, g) ?? {}, b)],
  ["DELETE", /^courses\/1\/assignment_groups\/(\d+)$/, ([g]) => ((state.assignmentGroups = state.assignmentGroups.filter((x) => String(x.id) !== g)), {})],

  ["GET", /^courses\/1\/assignments$/, () => state.assignments],
  ["POST", /^courses\/1\/assignments$/, (_, b) => {
    const a = { published: false, assignment_group_id: 1, submission_types: ["none"], ...unwrap(b, "assignment"), id: id() };
    a.html_url = `${self}/courses/1/assignments/${a.id}`;
    state.assignments.push(a);
    return a;
  }],
  ["GET", /^courses\/1\/assignments\/(\d+)$/, ([a]) => byId(state.assignments, a)],
  ["PUT", /^courses\/1\/assignments\/(\d+)$/, ([a], b) => Object.assign(byId(state.assignments, a) ?? {}, unwrap(b, "assignment"))],
  ["DELETE", /^courses\/1\/assignments\/(\d+)$/, ([a]) => ((state.assignments = state.assignments.filter((x) => String(x.id) !== a)), {})],
  ["GET", /^courses\/1\/assignments\/(\d+)\/overrides$/, () => []],
  ["POST", /^courses\/1\/rubrics$/, (_, b) => ({ rubric: { id: id(), ...unwrap(b, "rubric") }, rubric_association: unwrap(b, "rubric_association") })],

  ["GET", /^courses\/1\/quizzes$/, () => state.quizzes.map((q) => ({ ...q, question_count: (state.questions[q.id] ?? []).length }))],
  ["POST", /^courses\/1\/quizzes$/, (_, b) => {
    const q = { published: false, quiz_type: "assignment", ...unwrap(b, "quiz"), id: id() };
    state.quizzes.push(q);
    state.questions[q.id] = [];
    state.quizGroups[q.id] = [];
    return q;
  }],
  ["GET", /^courses\/1\/quizzes\/(\d+)$/, ([q]) => byId(state.quizzes, q)],
  ["PUT", /^courses\/1\/quizzes\/(\d+)$/, ([q], b) => Object.assign(byId(state.quizzes, q) ?? {}, unwrap(b, "quiz"))],
  ["DELETE", /^courses\/1\/quizzes\/(\d+)$/, ([q]) => ((state.quizzes = state.quizzes.filter((x) => String(x.id) !== q)), {})],
  ["GET", /^courses\/1\/quizzes\/(\d+)\/questions$/, ([q]) => [...(state.questions[q] ?? [])].sort((a, b) => a.position - b.position)],
  ["POST", /^courses\/1\/quizzes\/(\d+)\/questions$/, ([q], b) => {
    const question = { ...unwrap(b, "question"), id: id(), quiz_id: Number(q) };
    question.answers = (question.answers ?? []).map((a) => ({ id: id(), text: a.answer_text ?? a.text ?? "", html: a.answer_html ?? a.html ?? "", weight: a.answer_weight ?? a.weight ?? 0, ...a }));
    question.position ??= (state.questions[q] ?? []).length + 1;
    (state.questions[q] ??= []).push(question);
    return question;
  }],
  ["PUT", /^courses\/1\/quizzes\/(\d+)\/questions\/(\d+)$/, ([q, n], b) => Object.assign(byId(state.questions[q] ?? [], n) ?? {}, unwrap(b, "question"))],
  ["DELETE", /^courses\/1\/quizzes\/(\d+)\/questions\/(\d+)$/, ([q, n]) => ((state.questions[q] = (state.questions[q] ?? []).filter((x) => String(x.id) !== n)), {})],
  ["POST", /^courses\/1\/quizzes\/(\d+)\/reorder$/, ([q], b) => {
    (b.order ?? []).filter((o) => o.type === "question").forEach((o, i) => Object.assign(byId(state.questions[q] ?? [], o.id) ?? {}, { position: i + 1 }));
    return {};
  }],
  ["POST", /^courses\/1\/quizzes\/(\d+)\/groups$/, ([q], b) => {
    const group = { id: id(), quiz_id: Number(q), ...(b.quiz_groups?.[0] ?? {}) };
    (state.quizGroups[q] ??= []).push(group);
    return { quiz_groups: [group] };
  }],
  ["PUT", /^courses\/1\/quizzes\/(\d+)\/groups\/(\d+)$/, ([q, g], b) => ({ quiz_groups: [Object.assign(byId(state.quizGroups[q] ?? [], g) ?? {}, b.quiz_groups?.[0] ?? {})] })],
  ["DELETE", /^courses\/1\/quizzes\/(\d+)\/groups\/(\d+)$/, ([q, g]) => ((state.quizGroups[q] = (state.quizGroups[q] ?? []).filter((x) => String(x.id) !== g)), {})],
  ["POST", /^courses\/1\/quizzes\/(\d+)\/groups\/(\d+)\/reorder$/, () => ({})],
  ["GET", /^courses\/1\/quizzes\/(\d+)\/submissions$/, () => ({ quiz_submissions: [] })],

  ["GET", /^courses\/1\/pages$/, () => state.pages],
  ["POST", /^courses\/1\/pages$/, (_, b) => {
    const fields = unwrap(b, "wiki_page");
    const page = { published: false, front_page: false, body: "", ...fields, page_id: id(), url: slug(fields.title ?? "page") };
    state.pages.push(page);
    return page;
  }],
  ["GET", /^courses\/1\/pages\/([^/]+)$/, ([p]) => state.pages.find((x) => String(x.page_id) === p || x.url === p)],
  ["PUT", /^courses\/1\/pages\/([^/]+)$/, ([p], b) => {
    const page = state.pages.find((x) => String(x.page_id) === p || x.url === p);
    if (!page) return undefined;
    const fields = unwrap(b, "wiki_page");
    Object.assign(page, fields, fields.title ? { url: slug(fields.title) } : {});
    return page;
  }],
  ["DELETE", /^courses\/1\/pages\/([^/]+)$/, ([p]) => ((state.pages = state.pages.filter((x) => String(x.page_id) !== p && x.url !== p)), {})],
  ["GET", /^courses\/1\/front_page$/, () => state.frontPage],
  ["PUT", /^courses\/1\/front_page$/, (_, b) => (state.frontPage = { url: "home", ...state.frontPage, ...unwrap(b, "wiki_page") })],

  ["GET", /^courses\/1\/modules$/, (_, __, q) => state.modules.map((m) => moduleOut(m, q.includes("items")))],
  ["POST", /^courses\/1\/modules$/, (_, b) => {
    const m = { published: false, position: state.modules.length + 1, ...unwrap(b, "module"), id: id(), items: [] };
    state.modules.push(m);
    return moduleOut(m, false);
  }],
  ["GET", /^courses\/1\/modules\/(\d+)$/, ([m], _, q) => byId(state.modules, m) && moduleOut(byId(state.modules, m), q.includes("items"))],
  ["PUT", /^courses\/1\/modules\/(\d+)$/, ([m], b) => moduleOut(Object.assign(byId(state.modules, m) ?? { items: [] }, unwrap(b, "module")), false)],
  ["DELETE", /^courses\/1\/modules\/(\d+)$/, ([m]) => ((state.modules = state.modules.filter((x) => String(x.id) !== m)), {})],
  ["GET", /^courses\/1\/modules\/(\d+)\/items$/, ([m]) => (byId(state.modules, m)?.items ?? []).map((i) => ({ ...i, published: itemPublished(i) }))],
  ["POST", /^courses\/1\/modules\/(\d+)\/items$/, ([m], b) => {
    const mod = byId(state.modules, m);
    if (!mod) return undefined;
    const fields = unwrap(b, "module_item");
    const item = { ...fields, id: id(), module_id: mod.id, position: fields.position ?? mod.items.length + 1 };
    if (item.type === "Page" && !item.title) item.title = state.pages.find((p) => p.url === item.page_url)?.title;
    mod.items.push(item);
    return item;
  }],
  ["PUT", /^courses\/1\/modules\/(\d+)\/items\/(\d+)$/, ([m, i], b) => {
    const from = state.modules.find((x) => x.items.some((y) => String(y.id) === i));
    const item = from?.items.find((y) => String(y.id) === i);
    if (!item) return undefined;
    Object.assign(item, unwrap(b, "module_item"));
    if (String(item.module_id) !== m || (b.module_item?.module_id && String(b.module_item.module_id) !== String(from.id))) {
      const to = byId(state.modules, b.module_item?.module_id ?? m);
      from.items = from.items.filter((y) => y !== item);
      item.module_id = to.id;
      to.items.push(item);
    }
    return item;
  }],
  ["DELETE", /^courses\/1\/modules\/(\d+)\/items\/(\d+)$/, ([m, i]) => {
    const mod = byId(state.modules, m);
    if (mod) mod.items = mod.items.filter((y) => String(y.id) !== i);
    return {};
  }],
  ["GET", /^courses\/1\/module_item_sequence$/, () => ({ items: [] })],

  ["GET", /^courses\/1\/files$/, () => state.files],
  ["GET", /^courses\/1\/folders$/, () => state.folders],
  ["POST", /^courses\/1\/files$/, (_, b) => {
    const token = String(id());
    state.uploads[token] = { name: b.name, folder: folderAt(b.parent_folder_path) };
    return { upload_url: `${self}/__upload/${token}`, upload_params: {} };
  }],
  ["GET", /^files\/(\d+)$/, ([f]) => byId(state.files, f)],
  ["PUT", /^files\/(\d+)$/, ([f], b) => {
    const file = byId(state.files, f);
    if (!file) return undefined;
    if (b.name) Object.assign(file, { display_name: b.name, filename: b.name });
    if (b.locked !== undefined) file.locked = !!b.locked;
    return file;
  }],
  ["DELETE", /^files\/(\d+)$/, ([f]) => ((state.files = state.files.filter((x) => String(x.id) !== f)), {})],
];

/** The fields and file of a multipart form, as the app's uploads send them. */
function parseMultipart(buffer, contentType) {
  const boundary = /boundary=(.+)$/.exec(contentType ?? "")?.[1];
  const fields = {};
  if (!boundary) return fields;
  for (const part of buffer.toString("latin1").split(`--${boundary}`)) {
    const [head, ...rest] = part.split("\r\n\r\n");
    const name = /name="([^"]+)"/.exec(head)?.[1];
    if (!name) continue;
    const value = rest.join("\r\n\r\n").replace(/\r\n$/, "");
    fields[name] = /filename="/.test(head) ? Buffer.from(value, "latin1") : value;
  }
  return fields;
}

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, self);
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data ?? {}));
    };
    if (url.pathname === "/__state") return send(200, state);
    if (url.pathname === "/__unknown") return send(200, unknown);
    if (url.pathname === "/__requests") return send(200, requests.splice(0));
    requests.push(`${req.method} ${url.pathname.replace(/\/\d+/g, "/:id")}`);
    const upload = /^\/__upload\/(\d+)$/.exec(url.pathname);
    if (upload && req.method === "POST") {
      const pending = state.uploads[upload[1]];
      const { file } = parseMultipart(raw, req.headers["content-type"]);
      if (!pending || !file) return send(400, { error: "no such upload" });
      // a file of the same name in the folder is replaced, as Canvas's default "overwrite" does: a new id
      state.files = state.files.filter((f) => !(f.folder_id === pending.folder.id && f.display_name === pending.name));
      const made = { id: id(), display_name: pending.name, filename: pending.name, folder_id: pending.folder.id, size: file.length, locked: false, "content-type": "application/octet-stream" };
      made.url = `${self}/files/${made.id}/download`;
      state.files.push(made);
      return send(201, made);
    }
    const path = url.pathname.replace(/^\/api\/v1\//, "");
    const query = decodeURIComponent(url.search);
    let body = {};
    if (raw.length) body = /multipart/.test(req.headers["content-type"] ?? "") ? parseMultipart(raw, req.headers["content-type"]) : JSON.parse(raw.toString() || "{}");
    for (const [method, pattern, handle] of routes) {
      const match = method === req.method && pattern.exec(path);
      if (!match) continue;
      const result = handle(match.slice(1).map(decodeURIComponent), body, query);
      return result === undefined ? send(404, { errors: [{ message: "The specified resource does not exist." }] }) : send(200, result);
    }
    unknown.push(`${req.method} ${url.pathname}${url.search}`);
    send(404, { errors: [{ message: `fake Canvas: ${req.method} ${path} is not known here` }] });
  })
  .listen(port, host, () => console.log(`fake Canvas on ${self}`));
