import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useQuery } from "@tanstack/react-query";

// non-suspense on purpose: a slow or failing Docker Hub call must never hold
// up rendering the home page
export const useVersionStatusQuery = () => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.version.getStatus.queryOptions(),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });
};
