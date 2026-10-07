"use client";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { useEffect, useState } from "react";
import QuizPreview from "./QuizPreview";
import { QuizButtons } from "./QuizButton";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import {
  useQuizQuery,
  useUpdateQuizMutation,
} from "@/features/local/quizzes/quizHooks";
import { useAuthoritativeUpdates } from "../../../../utils/useAuthoritativeUpdates";
import EditQuizHeader from "./EditQuizHeader";
import { UpdateQuizName } from "./UpdateQuizName";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useGlobalSettingsQuery } from "@/features/local/globalSettings/globalSettingsHooks";
import { getFeedbackDelimitersFromSettings } from "@/features/local/globalSettings/globalSettingsUtils";
import type { GlobalSettings } from "@/features/local/globalSettings/globalSettingsModels";
import { EditLayout } from "@/components/EditLayout";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";
import { QuizHelp } from "./QuizHelp";

export default function EditQuiz({
  moduleName,
  quizName,
}: {
  quizName: string;
  moduleName: string;
}) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { courseName } = useCourseContext();
  const {
    data: quiz,
    dataUpdatedAt: serverDataUpdatedAt,
    isFetching,
  } = useQuizQuery(moduleName, quizName);
  const updateQuizMutation = useUpdateQuizMutation();
  const { data: globalSettings } = useGlobalSettingsQuery();
  const feedbackDelimiters = getFeedbackDelimitersFromSettings(
    (globalSettings ?? ({} as GlobalSettings)) as GlobalSettings,
  );

  const { clientIsAuthoritative, text, textUpdate, monacoKey } =
    useAuthoritativeUpdates({
      itemKey: `quiz:${moduleName}/${quizName}`,
      serverUpdatedAt: serverDataUpdatedAt,
      startingText: quizMarkdownUtils.toMarkdown(quiz, feedbackDelimiters),
    });

  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const delay = 1000;
    const handler = setTimeout(async () => {
      if (isFetching || updateQuizMutation.isPending) {
        console.log("network requests in progress, not updating page");
        return;
      }
      try {
        const updatedQuiz = quizMarkdownUtils.parseMarkdown(
          text,
          quizName,
          feedbackDelimiters,
        );
        quizMarkdownUtils.assertCanRoundTrip(updatedQuiz, feedbackDelimiters);

        const serverMarkdown = quizMarkdownUtils.toMarkdown(
          quiz,
          feedbackDelimiters,
        );
        const updatedMarkdown = quizMarkdownUtils.toMarkdown(
          updatedQuiz,
          feedbackDelimiters,
        );
        if (serverMarkdown !== updatedMarkdown) {
          if (clientIsAuthoritative) {
            await updateQuizMutation.mutateAsync({
              quiz: updatedQuiz,
              moduleName,
              quizName: quizName,
              previousModuleName: moduleName,
              previousQuizName: quizName,
              courseName,
            });
          } else {
            console.log(
              "client not authoritative, updating client with server quiz",
            );
            textUpdate(serverMarkdown, true);
          }
        }
        setError("");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setError(e.toString());
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [
    clientIsAuthoritative,
    courseName,
    feedbackDelimiters,
    isFetching,
    moduleName,
    quiz,
    quizName,
    text,
    textUpdate,
    updateQuizMutation,
  ]);

  return (
    <EditLayout
      Header={<EditQuizHeader quizName={quizName} />}
      HeaderActions={
        <UpdateQuizName quizName={quizName} moduleName={moduleName} />
      }
      Help={
        showHelp ? (
          <QuizHelp settings={settings} feedbackDelimiters={feedbackDelimiters} />
        ) : undefined
      }
      onCloseHelp={() => setShowHelp(false)}
      Editor={<MonacoEditor key={monacoKey} value={text} onChange={textUpdate} />}
      Preview={
        <>
          <div className="text-red-300">{error && error}</div>
          <QuizPreview moduleName={moduleName} quizName={quizName} />
        </>
      }
      Footer={
        <ClientOnly>
          <SuspenseAndErrorHandling>
            <QuizButtons
              moduleName={moduleName}
              quizName={quizName}
              toggleHelp={() => setShowHelp((h) => !h)}
            />
          </SuspenseAndErrorHandling>
        </ClientOnly>
      }
    />
  );
}
