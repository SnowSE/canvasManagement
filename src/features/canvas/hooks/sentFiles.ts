/**
 * What this browser remembers of the course files it sent to Canvas, so a
 * file edited since shows as edited even when it is as long as it was
 * (Canvas says only how long its copy is), and a file moved to another
 * module since replaces its old copy there instead of leaving it. Kept in
 * the browser, by Canvas course and the file's place: nothing about a sent
 * file is written into the course's own files. Without it (another
 * browser), a file is compared by length and a move leaves the old copy.
 */
type Sent = { id: number; hash: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (canvasCourseId: number, path: string) => `sentFile/${canvasCourseId}/${path}`;

export const sentFilesIn = (store: () => Store) => ({
  recall(canvasCourseId: number, path: string): Sent | undefined {
    try {
      return JSON.parse(store().getItem(key(canvasCourseId, path)) ?? "null") ?? undefined;
    } catch {
      return undefined;
    }
  },
  remember(canvasCourseId: number, path: string, sent: Sent) {
    store().setItem(key(canvasCourseId, path), JSON.stringify(sent));
  },
  /** A file moved or renamed here: what was remembered of it goes to its new place (where anything remembered was of a file no longer there). */
  move(canvasCourseId: number, from: string, to: string) {
    const sent = this.recall(canvasCourseId, from);
    store().removeItem(key(canvasCourseId, from));
    store().removeItem(key(canvasCourseId, to));
    if (sent) this.remember(canvasCourseId, to, sent);
  },
});

export const sentFiles = sentFilesIn(() => localStorage);
