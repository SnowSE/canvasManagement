import { lazy, Suspense } from "react";
import "./MonacoEditor.css";

const InnerMonacoEditor = lazy(() => import("./InnerMonacoEditorOther"));

export const MonacoEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  /** What to colour the text as; markdown unless given. */
  language?: string;
}> = ({ value, onChange, language }) => {
  return (
    <Suspense fallback={null}>
      <InnerMonacoEditor value={value} onChange={onChange} language={language} />
    </Suspense>
  );
};
