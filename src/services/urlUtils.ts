// Defined here (not in canvasServiceUtils) so pure url helpers don't pull in axios.
export const baseCanvasUrl = "https://snow.instructure.com";

export function getModuleItemUrl(
  courseName: string,
  moduleName: string,
  type: "assignment" | "page" | "quiz",
  itemName: string
) {
  return (
    "/course/" +
    encodeURIComponent(courseName) +
    "/modules/" +
    encodeURIComponent(moduleName) +
    `/${type}/` +
    encodeURIComponent(itemName)
  );
}
export function getLectureUrl(courseName: string, lectureDate: string) {
  return (
    "/course/" +
    encodeURIComponent(courseName) +
    "/lecture/" +
    encodeURIComponent(lectureDate)
  );
}
export function getLecturePreviewUrl(courseName: string, lectureDate: string) {
  return getLectureUrl(courseName, lectureDate) + "/preview";
}

export function getCourseUrl(courseName: string) {
  return "/course/" + encodeURIComponent(courseName);
}

export function getCourseSettingsUrl(courseName: string) {
  return "/course/" + encodeURIComponent(courseName) + "/settings";
}

const moduleItemTypeByFolder = {
  pages: "page",
  assignments: "assignment",
  quizzes: "quiz",
} as const;

// Rewrites relative .md hrefs in rendered markdown (e.g.
// "../../01%20Chaos%20KV/pages/KV%20Wire%20Protocol%20Spec.md") to in-app
// module item routes, so links between course files are clickable in preview
// panes. Absolute urls and hrefs that don't end in <module>/<pages|assignments|quizzes>/<name>.md
// are left untouched.
export function resolveRelativeMdHrefsInHtml(html: string, courseName: string) {
  return rewriteRelativeMdHrefs(html, ({ moduleName, type, itemName }) =>
    moduleName
      ? getModuleItemUrl(courseName, moduleName, type, itemName)
      : undefined
  );
}

// Mirrors how Canvas derives a wiki page's url from its title
// ("KV Wire Protocol Spec" -> "kv-wire-protocol-spec").
export function canvasPageSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Canvas items whose ids we need to build links to them. Pages are addressed
// by title slug so they don't need to be listed.
export type CanvasLinkTargets = {
  assignments?: { name: string; id: number }[];
  quizzes?: { title: string; id: number }[];
};

// Rewrites relative .md hrefs to the real Canvas urls when publishing,
// otherwise Canvas resolves "../pages/Foo.md" relative to the assignment url and
// produces a dead link. Assignment/quiz links are resolved through `targets`
// (the course's canvas assignments/quizzes); if the target hasn't been
// published to Canvas yet the href is left untouched.
export function resolveRelativeMdHrefsForCanvas(
  html: string,
  canvasCourseId: number,
  targets: CanvasLinkTargets = {}
) {
  const courseUrl = `${baseCanvasUrl}/courses/${canvasCourseId}`;
  return rewriteRelativeMdHrefs(html, ({ type, itemName }) => {
    if (type === "page") return `${courseUrl}/pages/${canvasPageSlug(itemName)}`;
    if (type === "assignment") {
      const id = targets.assignments?.find((a) => a.name === itemName)?.id;
      return id === undefined ? undefined : `${courseUrl}/assignments/${id}`;
    }
    const id = targets.quizzes?.find((q) => q.title === itemName)?.id;
    return id === undefined ? undefined : `${courseUrl}/quizzes/${id}`;
  });
}

function rewriteRelativeMdHrefs(
  html: string,
  toHref: (item: {
    // undefined for same-module links like "../pages/Foo.md"
    moduleName: string | undefined;
    type: "page" | "assignment" | "quiz";
    itemName: string;
  }) => string | undefined
) {
  return html.replace(/href="([^"]+\.md)"/g, (fullMatch, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/"))
      return fullMatch;
    let decoded: string;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      return fullMatch;
    }
    const parts = decoded.split("/").filter((p) => p !== "." && p !== "..");
    if (parts.length < 2) return fullMatch;
    const [folder, fileName] = parts.slice(-2);
    const moduleName = parts.length >= 3 ? parts[parts.length - 3] : undefined;
    const type =
      moduleItemTypeByFolder[folder as keyof typeof moduleItemTypeByFolder];
    if (!type) return fullMatch;
    const itemName = fileName.replace(/\.md$/, "");
    const newHref = toHref({ moduleName, type, itemName });
    return newHref ? `href="${newHref}"` : fullMatch;
  });
}
