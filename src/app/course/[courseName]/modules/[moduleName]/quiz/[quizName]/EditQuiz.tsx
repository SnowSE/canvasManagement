"use client";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import QuizPreview from "./QuizPreview";
import { QuizButtons } from "./QuizButton";
import { parsedOrNothing } from "@/app/course/[courseName]/utils/draft";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import {
  useQuizBanksQuery,
  useQuizQuery,
  useUpdateQuizMutation,
} from "@/features/local/quizzes/quizHooks";
import { useAuthoritativeUpdates } from "../../../../utils/useAuthoritativeUpdates";
import EditQuizHeader from "./EditQuizHeader";
import { UpdateQuizName } from "./UpdateQuizName";
import { useGlobalSettingsQuery } from "@/features/local/globalSettings/globalSettingsHooks";
import { getFeedbackDelimitersFromSettings } from "@/features/local/globalSettings/globalSettingsUtils";
import type { GlobalSettings } from "@/features/local/globalSettings/globalSettingsModels";
import { EditLayout } from "@/components/EditLayout";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";

export default function EditQuiz({
  moduleName,
  quizName,
}: {
  quizName: string;
  moduleName: string;
}) {
  const { courseName } = useCourseContext();
  const {
    data: quiz,
    isFetching,
  } = useQuizQuery(moduleName, quizName);
  const updateQuizMutation = useUpdateQuizMutation();
  const { data: globalSettings } = useGlobalSettingsQuery();
  const feedbackDelimiters = useMemo(
    () => getFeedbackDelimitersFromSettings((globalSettings ?? ({} as GlobalSettings)) as GlobalSettings),
    [globalSettings],
  );

  const { clientIsAuthoritative, text, textUpdate, textSaved, monacoKey } =
    useAuthoritativeUpdates({
      itemKey: `quiz:${moduleName}/${quizName}`,
      startingText: quizMarkdownUtils.toMarkdown(quiz, feedbackDelimiters),
    });

  const [error, setError] = useState("");

  const bankPaths = useMemo(() => quizMarkdownUtils.bankPaths(text), [text]);
  const { data: bankFiles } = useQuizBanksQuery(moduleName, bankPaths);
  // the footer compares what is typed, ahead of the save; deferred so typing stays smooth
  const settledText = useDeferredValue(text);
  const draft = useMemo(
    () =>
      parsedOrNothing(() => {
        const banks: Record<string, string> = {};
        for (const p of quizMarkdownUtils.bankPaths(settledText)) {
          const bank = bankFiles?.[p];
          if (!bank || "error" in bank) throw new Error("bank not read yet");
          banks[p] = bank.text;
        }
        return quizMarkdownUtils.parseMarkdown(settledText, quizName, feedbackDelimiters, banks);
      }),
    [settledText, quizName, feedbackDelimiters, bankFiles],
  );

  useEffect(() => {
    const delay = 1000;
    const handler = setTimeout(async () => {
      if (isFetching || updateQuizMutation.isPending) {
        console.log("network requests in progress, not updating page");
        return;
      }
      // wait for the banks the text names before reading it
      if (bankPaths.some((p) => !bankFiles?.[p])) return;
      try {
        const banks: Record<string, string> = {};
        for (const p of bankPaths) {
          const bank = bankFiles![p];
          if ("error" in bank) throw new Error(bank.error);
          banks[p] = bank.text;
        }
        const updatedQuiz = quizMarkdownUtils.parseMarkdown(
          text,
          quizName,
          feedbackDelimiters,
          banks,
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
            textSaved(updatedMarkdown);
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
    bankFiles,
    bankPaths,
    clientIsAuthoritative,
    courseName,
    feedbackDelimiters,
    isFetching,
    moduleName,
    quiz,
    quizName,
    text,
    textSaved,
    textUpdate,
    updateQuizMutation,
  ]);

  return (
    <EditLayout
      itemKey={`quiz:${moduleName}/${quizName}`}
      Header={<EditQuizHeader quizName={quizName} />}
      HeaderActions={
        <UpdateQuizName quizName={quizName} moduleName={moduleName} />
      }
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
              draft={draft}
            />
          </SuspenseAndErrorHandling>
        </ClientOnly>
      }
    />
  );
}
