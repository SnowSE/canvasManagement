import {
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

function makeQueryClient() {
  return new QueryClient({
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
