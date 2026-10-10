export type ErrorItemType = "Assignment" | "Quiz" | "Page" | "Lecture" | "Settings";

/** Where an error came from, for linking to it and for explaining it. */
export interface ErrorContext {
  courseName?: string;
  moduleName?: string;
  itemType?: ErrorItemType;
  itemName?: string;
  // on disk, for errors about a file
  filePath?: string;
}

export interface ErrorLogEntry {
  id: string;
  // what the app was doing, e.g. "Reading assignment W03 Lab"
  source: string;
  message: string;
  origin: "server" | "browser";
  context?: ErrorContext;
  count: number;
  firstSeen: string;
  lastSeen: string;
  // the thing that failed has since worked (e.g. the file parses now)
  resolved: boolean;
  explanation?: string;
}
