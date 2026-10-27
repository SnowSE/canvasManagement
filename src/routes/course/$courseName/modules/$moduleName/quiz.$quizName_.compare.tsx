import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { CompareQuizWithCanvas } from "@/app/course/[courseName]/modules/[moduleName]/compare/CompareWithCanvas";

// `$quizName_` keeps this page out of the quiz editor's layout while sharing
// its url prefix.
export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/quiz/$quizName_/compare",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: itemTitle("Compare: ", params.quizName),
        courseName: params.courseName,
        withAppName: false,
      }),
    ),
  component: CompareQuizPage,
});

function CompareQuizPage() {
  const { moduleName, quizName } = Route.useParams();
  return (
    <ClientOnly>
      <SuspenseAndErrorHandling>
        <CompareQuizWithCanvas
          moduleName={decodeURIComponent(moduleName)}
          quizName={decodeURIComponent(quizName)}
        />
      </SuspenseAndErrorHandling>
    </ClientOnly>
  );
}
