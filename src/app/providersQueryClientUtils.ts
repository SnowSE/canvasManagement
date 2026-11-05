import {
  InvalidateQueryFilters,
  InvalidateOptions,
  MutationCache,
  QueryCache,
  QueryClient,
  isServer,
} from "@tanstack/react-query";
import {
  describeQueryKey,
  reportBrowserError,
} from "@/features/local/errorLog/reportBrowserError";
import { getErrorMessage } from "@/services/utils/queryClient";

/**
 * Every window of the app refreshes what any window refreshed: a save in a
 * pop-out reaches the window it came from at once, and the other way round,
 * instead of waiting for that window to be focused. Only the query key
 * travels (over a BroadcastChannel); each window fetches for itself.
 */
function shareInvalidations(client: QueryClient) {
  const invalidate = client.invalidateQueries.bind(client);
  const channel = new BroadcastChannel("canvas-management-invalidations");
  // from another window: refresh here, without telling the others again
  channel.onmessage = (e) => invalidate({ queryKey: e.data });
  client.invalidateQueries = (filters?: InvalidateQueryFilters, options?: InvalidateOptions) => {
    if (filters?.queryKey) channel.postMessage(filters.queryKey);
    return invalidate(filters, options);
  };
}

function makeQueryClient() {
  const client = new QueryClient({
    // every failed request lands in the error log, handled or not
    queryCache: new QueryCache({
      onError: (error, query) =>
        reportBrowserError(describeQueryKey(query.queryKey), getErrorMessage(error)),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        reportBrowserError(
          describeQueryKey(mutation.options.mutationKey),
          getErrorMessage(error),
        ),
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
      mutations: {
        onError: (error) => {
          console.error("Unhandled mutation error:", error);
        },
      },
    },
  });
  if (!isServer) shareInvalidations(client);
  return client;
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
