import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/services/serverFunctions/appRouter";

// Plain functions like showErrorToast can't use hooks, so they report through
// their own client. The event tells the error pill to refresh right away.
export const errorLogChangedEvent = "error-log-changed";

let client: ReturnType<typeof createTRPCClient<AppRouter>> | undefined;

export const reportBrowserError = (source: string, message: string) => {
  if (typeof window === "undefined" || !message) return;
  client ??= createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc" })],
  });
  client.errorLog.report
    .mutate({ source, message })
    .then(() => window.dispatchEvent(new Event(errorLogChangedEvent)))
    .catch(() => {
      // nowhere left to report a failure to report
    });
};

/** A readable name for what a query or mutation was doing. */
export const describeQueryKey = (key: readonly unknown[] | undefined) => {
  if (!key || key.length === 0) return "a request";
  if (Array.isArray(key[0])) return `Server request ${key[0].join(".")}`;
  return `Loading ${key.filter((k) => typeof k === "string").join(" ")}`;
};
