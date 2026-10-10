import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { errorLogChangedEvent } from "./reportBrowserError";

export const useErrorLogQuery = () => {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.errorLog.list.queryOptions(),
    // server-side errors (a file that stopped parsing) have no other way in
    refetchInterval: 5_000,
  });
  const { refetch } = query;
  useEffect(() => {
    const onChange = () => refetch();
    window.addEventListener(errorLogChangedEvent, onChange);
    return () => window.removeEventListener(errorLogChangedEvent, onChange);
  }, [refetch]);
  return query;
};

const useInvalidateErrorLog = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: trpc.errorLog.list.queryKey() });
};

export const useDismissErrorMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateErrorLog();
  return useMutation(
    trpc.errorLog.dismiss.mutationOptions({ onSuccess: invalidate }),
  );
};

export const useClearErrorsMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateErrorLog();
  return useMutation(
    trpc.errorLog.clear.mutationOptions({ onSuccess: invalidate }),
  );
};

export const useExplainErrorMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateErrorLog();
  return useMutation(
    trpc.errorLog.explain.mutationOptions({ onSuccess: invalidate }),
  );
};
