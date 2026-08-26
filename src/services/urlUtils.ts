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
    if (parts.length < 3) return fullMatch;
    const [moduleName, folder, fileName] = parts.slice(-3);
    const type =
      moduleItemTypeByFolder[folder as keyof typeof moduleItemTypeByFolder];
    if (!type) return fullMatch;
    const itemName = fileName.replace(/\.md$/, "");
    return `href="${getModuleItemUrl(courseName, moduleName, type, itemName)}"`;
  });
}
