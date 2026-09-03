import { router } from "@/services/serverFunctions/trpcSetup";
import publicProcedure from "@/services/serverFunctions/publicProcedure";
import { getVersionStatus } from "./versionCheckService";

export const versionRouter = router({
  getStatus: publicProcedure.query(async () => {
    return await getVersionStatus();
  }),
});
