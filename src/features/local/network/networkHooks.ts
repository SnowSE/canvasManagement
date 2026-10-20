import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useQuery } from "@tanstack/react-query";

export const useNetworkExposureQuery = () => {
  const trpc = useTRPC();
  // it only changes when the container restarts
  return useQuery({ ...trpc.network.exposure.queryOptions(), staleTime: Infinity });
};
