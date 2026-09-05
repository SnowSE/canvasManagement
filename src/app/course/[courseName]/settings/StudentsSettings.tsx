"use client";
import { Spinner } from "@/components/Spinner";
import {
  useRosterStudentsQuery,
  useSyncRosterStudentsMutation,
} from "@/features/canvas/roster/rosterHooks";
import { studentLabels } from "@/features/local/assignments/models/utils/scheduleUtils";
import { settingsBox } from "./sharedSettings";
import { SyncedAgo } from "./SyncedAgo";
import { useCourseContext } from "../context/courseContext";

export default function StudentsSettings() {
  const { courseName } = useCourseContext();
  const studentsQuery = useRosterStudentsQuery();
  const sync = useSyncRosterStudentsMutation();
  const students = studentsQuery.data?.students ?? [];
  const labels = studentLabels(students);

  return (
    <div className={settingsBox}>
      <h5 className="text-center">Students</h5>
      <p className="text-center text-slate-500">
        Canvas roster for this course, used by the Schedule autocomplete
      </p>
      <div className="flex flex-row gap-3 items-center flex-wrap my-2">
        {studentsQuery.isLoading && (
          <span className="text-slate-500">loading from Canvas...</span>
        )}
        {studentsQuery.isError && (
          <span className="text-rose-300">
            could not load students: {studentsQuery.error.message}
          </span>
        )}
        {studentsQuery.data && (
          <span className="text-emerald-300">
            {students.length} student{students.length === 1 ? "" : "s"}
            {" · "}
            <SyncedAgo iso={studentsQuery.data.syncedAt} />
          </span>
        )}
        <div className="flex-1" />
        {(sync.isPending || studentsQuery.isFetching) && <Spinner />}
        <button disabled={sync.isPending} onClick={() => sync.mutate(courseName)}>
          Sync Students from Canvas
        </button>
      </div>
      {students.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-start px-2 py-1">Name</th>
                <th className="text-start px-2 py-1">Email</th>
                <th className="text-start px-2 py-1">Canvas id</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-slate-700">
                  <td className="px-2 py-1">{labels.get(s.id)}</td>
                  <td className="px-2 py-1 text-slate-400">{s.email}</td>
                  <td className="px-2 py-1 text-slate-400">{s.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-slate-500 text-sm mt-2">
        Assignment Schedule entries store only the Canvas id, so no student
        names end up in your course files. The editor shows the name beside
        each id while you work.
      </p>
    </div>
  );
}
