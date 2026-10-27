import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import { UnparsableItemFallback } from "@/app/course/[courseName]/modules/[moduleName]/unparsable/UnparsableItemFallback";
import EditQuiz from "@/app/course/[courseName]/modules/[moduleName]/quiz/[quizName]/EditQuiz";

export const Route = createFileRoute(
  "/course/$courseName/modules/$moduleName/quiz/$quizName",
)({
  head: ({ params }) =>
    titleHead(
      pageTitle({
        thing: itemTitle("Quiz: ", params.quizName),
        courseName: params.courseName,
      }),
    ),
  component: QuizPage,
});

function QuizPage() {
  const { moduleName, quizName } = Route.useParams();
  const decodedQuizName = decodeURIComponent(quizName);
  const decodedModuleName = decodeURIComponent(moduleName);
  return (
    <UnparsableItemFallback
      moduleName={decodedModuleName}
      type="Quiz"
      name={decodedQuizName}
    >
      <EditQuiz quizName={decodedQuizName} moduleName={decodedModuleName} />
    </UnparsableItemFallback>
  );
}
