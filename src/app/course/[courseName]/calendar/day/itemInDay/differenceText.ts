import { SyncField } from "../getAssignmentSyncStatus";

// short enough to read both values in one line of a hover card
const SHORT = 60;

/**
 * A difference as a line: both values when they're short, else its sentence
 * (always for a description, whose two texts are on the compare page).
 */
export const differenceText = (d: SyncField) =>
  d.section !== "description" && d.local.length + d.canvas.length <= SHORT
    ? `${d.label}: local ${d.local} vs Canvas ${d.canvas}`
    : d.message;
