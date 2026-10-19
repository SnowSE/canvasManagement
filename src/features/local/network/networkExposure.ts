import fs from "fs";
import { router } from "@/services/serverFunctions/trpcSetup";
import publicProcedure from "@/services/serverFunctions/publicProcedure";

// Inside its container the app always listens on 0.0.0.0:3000; whether other
// machines can reach it depends on the address Docker publishes the port on,
// which only the compose file knows. The compose file passes that address in
// as CANVAS_MANAGER_ADDRESS (the same variable its ports line uses).

export interface Exposure {
  kind: "local" | "network" | "unknown";
  address?: string;
  port?: string;
}

const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"];

/** How reachable the app is, from its environment; undefined outside a container. */
export function exposureOf(
  env: Record<string, string | undefined>,
  inContainer: boolean
): Exposure | undefined {
  const address = env.CANVAS_MANAGER_ADDRESS?.trim();
  const port = env.CANVAS_MANAGER_PORT?.trim() || undefined;
  if (!address) return inContainer ? { kind: "unknown", ...(port && { port }) } : undefined;
  return { kind: loopback.includes(address) ? "local" : "network", address, ...(port && { port }) };
}

export const networkRouter = router({
  exposure: publicProcedure.query(() =>
    exposureOf(process.env, fs.existsSync("/.dockerenv")) ?? null
  ),
});
