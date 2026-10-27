import { pageTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import ErrorLogPage from "@/app/errors/ErrorLogPage";

export const Route = createFileRoute("/errors")({
  head: () => titleHead(pageTitle({ thing: "Errors" })),
  component: () => (
    <ClientOnly>
      <ErrorLogPage />
    </ClientOnly>
  ),
});
