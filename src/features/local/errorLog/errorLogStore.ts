import { ErrorContext, ErrorLogEntry } from "./errorLogModels";

// Errors since the server started. Kept in memory only: this is a list of what
// went wrong this session, not a history, and it may quote course content.
const maxEntries = 200;

const globalForLog = globalThis as unknown as {
  __canvasManagerErrorLog?: Map<string, ErrorLogEntry>;
};
const entries = (globalForLog.__canvasManagerErrorLog ??= new Map());

let nextId = 1;

/**
 * Records an error. The same error seen again (same key, or same message when
 * there is no key) bumps its count instead of adding a row, so a file that is
 * read on every page load is one entry.
 */
export const logError = ({
  key,
  source,
  message,
  origin = "server",
  context,
}: {
  key?: string;
  source: string;
  message: string;
  origin?: "server" | "browser";
  context?: ErrorContext;
}) => {
  // a keyless report of an error already logged under a key (the browser
  // toasting a failed file read, say) is the same error, not a new one
  const sameMessage = key
    ? undefined
    : [...entries.entries()].find(([, e]) => e.message === message)?.[0];
  const entryKey = key ?? sameMessage ?? `message:${message}`;
  const now = new Date().toISOString();
  const existing = entries.get(entryKey);
  if (existing) {
    // a file error reported again unchanged (read on every page load, or
    // echoed by the request that failed on it) is still the one occurrence
    const isFileError = (key ?? sameMessage)?.startsWith("file:");
    if (isFileError && existing.message === message && !existing.resolved)
      return existing;
    existing.count += 1;
    existing.lastSeen = now;
    if (existing.message !== message) {
      existing.message = message;
      existing.explanation = undefined;
    }
    existing.resolved = false;
    return existing;
  }

  const entry: ErrorLogEntry = {
    id: String(nextId++),
    source,
    message,
    origin,
    context,
    count: 1,
    firstSeen: now,
    lastSeen: now,
    resolved: false,
  };
  entries.set(entryKey, entry);

  if (entries.size > maxEntries) {
    const oldest = [...entries.entries()].sort((a, b) =>
      a[1].lastSeen.localeCompare(b[1].lastSeen),
    )[0];
    entries.delete(oldest[0]);
  }
  return entry;
};

/** Marks a keyed error as fixed, e.g. when a file that failed to parse parses. */
export const resolveError = (key: string) => {
  const existing = entries.get(key);
  if (existing && !existing.resolved) existing.resolved = true;
};

export const fileErrorKey = (filePath: string) => `file:${filePath}`;

export const errorLog = {
  list: () =>
    [...entries.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
  get: (id: string) => [...entries.values()].find((e) => e.id === id),
  dismiss: (id: string) => {
    for (const [key, entry] of entries)
      if (entry.id === id) entries.delete(key);
  },
  clear: () => entries.clear(),
};

export const errorMessageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
