"use client";
import { Spinner } from "@/components/Spinner";
import {
  useRosterGroupSetsQuery,
  useRosterStudentsQuery,
  useSyncRosterGroupSetsMutation,
} from "@/features/canvas/roster/rosterHooks";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { baseCanvasUrl } from "@/services/urlUtils";
import { useState } from "react";
import { settingsBox } from "./sharedSettings";
import { SyncedAgo } from "./SyncedAgo";
import { useCourseContext } from "../context/courseContext";

export default function GroupsSettings() {
  const { courseName } = useCourseContext();
  const { data: settings } = useLocalCourseSettingsQuery();
  const groupSetsQuery = useRosterGroupSetsQuery();
  const { data: rosterData } = useRosterStudentsQuery();
  const sync = useSyncRosterGroupSetsMutation();
  const [selectedId, setSelectedId] = useState<number | undefined>();

  const groupSets = groupSetsQuery.data?.groupSets ?? [];
  const selected =
    groupSets.find((g) => g.id === selectedId) ?? groupSets[0];
  const manageUrl = `${baseCanvasUrl}/courses/${settings.canvasId}/groups`;

  const memberIds = new Set(
    selected?.groups.flatMap((g) => g.members.map((m) => m.id)) ?? []
  );
  const notInAGroup =
    rosterData?.students.filter((s) => !memberIds.has(s.id)) ?? [];

  return (
    <div className={settingsBox}>
      <h5 className="text-center">Groups</h5>
      <p className="text-center text-slate-500">
        Student group sets in Canvas. Assignments reference a set by name with{" "}
        <code>GroupSet:</code>
      </p>
      <div className="flex flex-row gap-3 items-center flex-wrap my-2">
        {groupSetsQuery.isLoading && (
          <span className="text-slate-500">loading from Canvas...</span>
        )}
        {groupSetsQuery.isError && (
          <span className="text-rose-300">
            could not load groups: {groupSetsQuery.error.message}
          </span>
        )}
        {groupSetsQuery.data && (
          <span className="text-emerald-300">
            {groupSets.length} group set{groupSets.length === 1 ? "" : "s"}
            {" · "}
            <SyncedAgo iso={groupSetsQuery.data.syncedAt} />
          </span>
        )}
        <div className="flex-1" />
        {(sync.isPending || groupSetsQuery.isFetching) && <Spinner />}
        <button
          className="btn-thin"
          disabled={sync.isPending}
          onClick={() => sync.mutate(courseName)}
        >
          Sync Groups from Canvas
        </button>
        <a className="btn" href={manageUrl} target="_blank" rel="noreferrer">
          Manage Groups in Canvas ↗
        </a>
      </div>

      {groupSetsQuery.data && groupSets.length === 0 && (
        <div className="text-slate-400 text-center py-3">
          No group sets in Canvas yet. Create one on the Canvas groups page,
          then sync.
        </div>
      )}

      {selected && (
        <>
          <div className="flex flex-row gap-1 flex-wrap border-b border-slate-700 mb-2">
            {groupSets.map((set) => {
              const memberCount = set.groups.reduce(
                (n, g) => n + g.members.length,
                0
              );
              const active = set.id === selected.id;
              return (
                <button
                  key={set.id}
                  className={
                    "unstyled px-3 py-1 rounded-t border border-b-0 " +
                    (active
                      ? " bg-slate-800 border-slate-700 text-slate-100 "
                      : " border-transparent text-slate-400 hover:text-slate-200 ")
                  }
                  onClick={() => setSelectedId(set.id)}
                >
                  {set.name}
                  <span className="text-slate-500 text-xs ps-2">
                    {set.groups.length} group{set.groups.length === 1 ? "" : "s"}
                    {rosterData && ` · ${memberCount} / ${rosterData.students.length}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
            {selected.groups.map((group) => (
              <div
                key={group.id}
                className="rounded-md border border-slate-700 bg-slate-800 p-2 text-sm"
              >
                <div className="flex justify-between font-semibold">
                  <span>{group.name}</span>
                  <span className="text-slate-500">{group.members.length}</span>
                </div>
                {group.members.length === 0 && (
                  <div className="text-slate-500">empty</div>
                )}
                {group.members.map((m) => (
                  <div key={m.id}>{m.sortableName}</div>
                ))}
              </div>
            ))}
            {rosterData && notInAGroup.length > 0 && (
              <div className="rounded-md border border-dashed border-slate-700 p-2 text-sm">
                <div className="flex justify-between font-semibold text-slate-400">
                  <span>Not in a group</span>
                  <span className="text-slate-500">{notInAGroup.length}</span>
                </div>
                {notInAGroup.map((s) => (
                  <div key={s.id} className="text-slate-400">
                    {s.sortableName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
