/**
 * Updates the items one at a time (Canvas requests are queued anyway), going
 * on past any that fail. Returns the ones that failed.
 */
export async function updateEach<T>(
  items: T[],
  update: (item: T) => Promise<unknown>,
  onProgress: (done: number) => void,
) {
  const failed: T[] = [];
  for (const [i, item] of items.entries()) {
    await update(item).catch(() => failed.push(item));
    onProgress(i + 1);
  }
  return failed;
}
