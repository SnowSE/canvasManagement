import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import ErrorLogPage from "@/app/errors/ErrorLogPage";

export const Route = createFileRoute("/errors")({
  component: () => (
    <ClientOnly>
      <ErrorLogPage />
    </ClientOnly>
  ),
});
