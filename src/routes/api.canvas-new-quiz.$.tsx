import { createFileRoute } from "@tanstack/react-router";
import { axiosClient, describeAxiosError } from "@/services/axiosUtils";
import { isAxiosError } from "axios";

// Read-only proxy to the New Quizzes API (/api/quiz/v1), which sits beside
// the /api/v1 that /api/canvas proxies. Import is the only user.
const getUrl = (splat: string | undefined, req: Request) => {
  const url = new URL(`https://snow.instructure.com/api/quiz/v1/${splat ?? ""}`);
  new URL(req.url).searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url;
};

export const Route = createFileRoute("/api/canvas-new-quiz/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const url = getUrl(params._splat, request);
          const response = await axiosClient.get(url.toString());
          return Response.json(response.data);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.log(
            "canvas new quiz get error",
            isAxiosError(error) ? describeAxiosError(error) : error,
          );
          return Response.json(
            { error: error.message || "Canvas New Quizzes GET request failed" },
            { status: error.response?.status || 500 },
          );
        }
      },
    },
  },
});
