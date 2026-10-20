import { createMiddleware, createStart } from "@tanstack/react-start";
import { refusal } from "./services/requestGuard";

// every /api request must come from this app's own pages or a program on this
// computer (see requestGuard.ts)
const apiFromThisAppOnly = createMiddleware().server(({ request, next }) => refusal(request) ?? next());

export const startInstance = createStart(() => ({
  requestMiddleware: [apiFromThisAppOnly],
}));
