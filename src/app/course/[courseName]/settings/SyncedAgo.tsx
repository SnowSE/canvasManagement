"use client";

/** "synced 4 minutes ago" for a snapshot timestamp. */
export function SyncedAgo({ iso }: { iso: string }) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const text =
    seconds < 60
      ? "just now"
      : seconds < 3600
        ? `${Math.round(seconds / 60)} min ago`
        : seconds < 86400
          ? `${Math.round(seconds / 3600)} h ago`
          : new Date(iso).toLocaleString();
  return (
    <span className="text-slate-400" title={new Date(iso).toLocaleString()}>
      synced from Canvas {text}
    </span>
  );
}
