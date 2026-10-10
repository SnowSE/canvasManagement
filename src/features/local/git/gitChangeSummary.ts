// Pure helpers for turning `git status` output into words. Kept apart from the
// service so they can be tested without a repository.

export type GitChangeKind = "added" | "edited" | "deleted" | "renamed";

export interface GitChange {
  // relative to the course folder
  path: string;
  kind: GitChangeKind;
}

/** Parses `git status --porcelain=v1 -z` output. Paths stay repo-relative. */
export const parsePorcelain = (output: string) => {
  const fields = output.split("\0").filter((f) => f.length > 0);
  const changes: { path: string; kind: GitChangeKind }[] = [];
  for (let i = 0; i < fields.length; i++) {
    const code = fields[i].slice(0, 2);
    const filePath = fields[i].slice(3);
    let kind: GitChangeKind = "edited";
    if (code === "??" || code.includes("A")) kind = "added";
    else if (code.includes("D")) kind = "deleted";
    else if (code.includes("R")) {
      kind = "renamed";
      i++; // the old name follows a rename
    }
    changes.push({ path: filePath, kind });
  }
  return changes;
};

const folderLabels: Record<string, string> = {
  assignments: "assignment",
  quizzes: "quiz",
  pages: "page",
};

/** "assignment W03 Lab", "lecture week-03 3-Wednesday", "course settings". */
export const describePath = (coursePath: string) => {
  const parts = coursePath.split("/");
  const file = parts[parts.length - 1].replace(/\.md$/, "");
  if (parts.length === 1 && parts[0] === "settings.yml") return "course settings";
  if (parts.length === 3 && folderLabels[parts[1]])
    return `${folderLabels[parts[1]]} ${file}`;
  if (parts[0] === "00 - lectures" && parts.length === 3)
    return `lecture ${parts[1]} ${file}`;
  return coursePath;
};

const verbs: Record<GitChangeKind, string> = {
  added: "add",
  edited: "edit",
  deleted: "delete",
  renamed: "rename",
};

/**
 * A commit message for a course's changes: a short subject naming what
 * changed, and every change listed underneath.
 */
export const suggestCommitMessage = (courseName: string, changes: GitChange[]) => {
  if (changes.length === 0) return "";
  const described = changes.map((c) => ({ ...c, label: describePath(c.path) }));

  let subject: string;
  if (described.length <= 3) {
    const byVerb = new Map<string, string[]>();
    for (const c of described)
      byVerb.set(verbs[c.kind], [...(byVerb.get(verbs[c.kind]) ?? []), c.label]);
    subject = [...byVerb.entries()]
      .map(([verb, labels]) => `${verb} ${labels.join(", ")}`)
      .join("; ");
  } else {
    const counts = new Map<string, number>();
    for (const c of described)
      counts.set(verbs[c.kind], (counts.get(verbs[c.kind]) ?? 0) + 1);
    subject = [...counts.entries()]
      .map(([verb, n]) => `${verb} ${n}`)
      .join(", ") + " files";
  }

  const body = described.map((c) => `- ${verbs[c.kind]} ${c.label}`).join("\n");
  return `${courseName}: ${subject}\n\n${body}`;
};
