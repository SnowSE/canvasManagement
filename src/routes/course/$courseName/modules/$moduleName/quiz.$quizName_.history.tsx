import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { ItemHistory } from "@/app/course/[courseName]/modules/[moduleName]/history/ItemHistory";

// `$quizName_` keeps this page out of the editor's layout while sharing its url prefix.
export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/quiz/$quizName_/history",
)({
  component: QuizHistoryPage,
});

function QuizHistoryPage() {
  const { moduleName, quizName } = Route.useParams();
  return (
    <ClientOnly>
      <SuspenseAndErrorHandling>
        <ItemHistory
          moduleName={decodeURIComponent(moduleName)}
          type="Quiz"
          name={decodeURIComponent(quizName)}
        />
      </SuspenseAndErrorHandling>
    </ClientOnly>
  );
}
