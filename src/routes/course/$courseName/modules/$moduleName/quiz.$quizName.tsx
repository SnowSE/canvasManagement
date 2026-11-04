import { pageTitle, itemTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";

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

// the frame renders the item's editing from the url (see ItemEditing)
function QuizPage() {
  return null;
}
