import { lazy, Suspense } from "react";
import "./MonacoEditor.css";

const InnerMonacoEditor = lazy(() => import("./InnerMonacoEditorOther"));

export const MonacoEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  return (
    <Suspense fallback={null}>
      <InnerMonacoEditor value={value} onChange={onChange} />
    </Suspense>
  );
};
