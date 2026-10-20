export type Kind = "notInCanvas" | "needsSync" | "unpublished";
/** The module list's filters, in the order the bar shows them. */
export const kinds: { kind: Kind; label: string }[] = [
  { kind: "notInCanvas", label: "not in Canvas" },
  { kind: "needsSync", label: "needs sync" },
  { kind: "unpublished", label: "unpublished" },
];

/** The filters an item matches, from how it stands against Canvas. */
export const kindsOf = (s: {
  status: "localOnly" | "incomplete" | "published";
  differences: unknown[];
  unpublished?: boolean;
}): Kind[] => [
  ...(s.status === "localOnly" ? ["notInCanvas" as const] : []),
  ...(s.differences.length > 0 ? ["needsSync" as const] : []),
  ...(s.unpublished ? ["unpublished" as const] : []),
];

/** With no filter on everything shows; otherwise what matches any that's on. */
export const shown = (itemKinds: Kind[], filters: Kind[]) =>
  filters.length === 0 || itemKinds.some((k) => filters.includes(k));
