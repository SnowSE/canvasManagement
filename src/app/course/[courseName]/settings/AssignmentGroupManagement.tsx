"use client";

import {
  useLocalCourseSettingsQuery,
  useUpdateLocalCourseSettingsMutation,
} from "@/features/local/course/localCoursesHooks";
import { LocalAssignmentGroup } from "@/features/local/assignments/models/localAssignmentGroup";
import { Fragment, ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { settingsBox } from "./sharedSettings";
import MeatballIcon from "./MeatballIcon";
import {
  useAssignmentGroupsQuery,
  useCanvasAssignmentGroupCountsQuery,
  useMoveAssignmentGroupMutation,
  useSyncAssignmentGroupsMutation,
} from "@/features/canvas/hooks/canvasCourseHooks";
import { baseCanvasUrl } from "@/features/canvas/services/canvasServiceUtils";
import { showErrorToast } from "@/app/MyToaster";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { syncAssignmentGroups } from "./syncAssignmentGroups";

const input = "bg-slate-800 border border-slate-500 rounded-md px-1";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The course's assignment groups beside Canvas's, each saying what Sync
 * With Canvas will do. Nothing here deletes an assignment: removing a group
 * moves its items to another (only an empty one is just removed), renaming
 * moves them to the new name, and syncing only adds groups and sets weights.
 */
export default function AssignmentGroupManagement() {
  const { data: settings } = useLocalCourseSettingsQuery();
  const updateSettings = useUpdateLocalCourseSettingsMutation();
  const sync = useSyncAssignmentGroupsMutation();
  const trpc = useTRPC();
  const { data: fileCounts } = useQuery(
    trpc.settings.assignmentGroupItemCounts.queryOptions(settings.name),
  );
  const { data: canvasCounts } = useCanvasAssignmentGroupCountsQuery(settings.canvasId);
  const { data: canvasGroups } = useAssignmentGroupsQuery(settings.canvasId);
  const [weights, setWeights] = useState<Record<string, number>>({});
  // the groups as typed, weights saved a moment after typing stops
  const groups = settings.assignmentGroups.map((g) => ({ ...g, weight: weights[g.id] ?? g.weight }));
  const preview = canvasGroups && syncAssignmentGroups(groups, canvasGroups, () => "");

  useEffect(() => {
    if (groups.every((g, i) => g.weight === settings.assignmentGroups[i].weight)) return;
    const handler = setTimeout(
      () => updateSettings.mutate({ ...settings, assignmentGroups: groups }),
      1000,
    );
    return () => clearTimeout(handler);
  }, [groups, settings, updateSettings]);

  const addGroup = () => {
    let name = "New group";
    for (let n = 2; groups.some((g) => g.name === name); n++) name = `New group ${n}`;
    updateSettings.mutate({
      ...settings,
      assignmentGroups: [...groups, { id: crypto.randomUUID(), name, weight: 0 }],
    });
  };

  return (
    <div className={settingsBox}>
      <div className="grid grid-cols-[1fr_5rem_auto_auto_auto_auto] gap-x-3 gap-y-1 items-center">
        <div>Group</div>
        <div>Weight</div>
        <div>Canvas weight</div>
        <div title="Assignment and quiz files that name the group">Files</div>
        <div title="Assignments and quizzes in the group in Canvas">Canvas items</div>
        <div />
        {groups.map((group) => {
          // the Canvas group sync pairs it with, by id or else name
          const canvasId = preview?.groups.find((g) => g.id === group.id)?.canvasId;
          const files = fileCounts && (fileCounts[group.name] ?? 0);
          const canvasItems = canvasId ? canvasCounts && (canvasCounts[canvasId] ?? 0) : 0;
          return (
          <GroupRow
            key={group.id}
            group={group}
            groups={groups}
            // unknown until counted
            files={files}
            canvasItems={canvasItems}
            canvas={
              <>
                <InCanvas
                  canvasWeight={canvasGroups?.find((c) => c.id === canvasId)?.group_weight}
                  weight={group.weight}
                  loaded={!!canvasGroups}
                />
                <div>{files ?? "…"}</div>
                <div>{canvasId ? (canvasItems ?? "…") : "—"}</div>
              </>
            }
            setWeight={(weight) => setWeights((w) => ({ ...w, [group.id]: weight }))}
          />
          );
        })}
        {preview?.added.map((group) => (
          <Fragment key={group.canvasId}>
            <div className="px-1 text-sky-400">{group.name}</div>
            <div className="px-1">—</div>
            <div className="text-sky-400">{group.weight} · added here on sync</div>
            <div>{fileCounts?.[group.name] ?? 0}</div>
            <div>{canvasCounts?.[group.canvasId!] ?? "…"}</div>
            <div />
          </Fragment>
        ))}
      </div>
      <div className="flex gap-3 mt-3">
        <button onClick={addGroup}>Add Group</button>
        <button
          disabled={sync.isPending}
          title="Adds the groups only Canvas has, creates the ones only listed here, and sets Canvas's weights to these. Deletes nothing."
          onClick={async () => {
            try {
              setWeights({});
              const { added, created, weights } = await sync.mutateAsync({ ...settings, assignmentGroups: groups });
              const changes = [
                added && `${plural(added, "group")} added from Canvas`,
                created && `${plural(created, "group")} created in Canvas`,
                weights && `${plural(weights, "weight")} set in Canvas`,
              ].filter(Boolean);
              toast.success(changes.length ? changes.join(", ") : "Assignment groups already match Canvas");
            } catch (e) {
              showErrorToast(`Couldn't sync the assignment groups: ${(e as Error).message}`);
            }
          }}
        >
          {sync.isPending ? "Syncing…" : "Sync With Canvas"}
        </button>
      </div>
      {sync.isSuccess && (
        <div className="mt-2">
          {"For the weights to count, open your course's assignments page "}
          <a
            href={`${baseCanvasUrl}/courses/${settings.canvasId}/assignments`}
            className="font-bold underline"
            target="_blank"
          >
            HERE
          </a>
          {" > settings ("}
          <MeatballIcon />
          {") > Assignment Group Weights and check 'Weight final grade based on assignment groups'."}
        </div>
      )}
    </div>
  );
}

/** A group's weight in Canvas, and what Sync With Canvas will do to it. */
function InCanvas({
  canvasWeight,
  weight,
  loaded,
}: {
  canvasWeight: number | undefined;
  weight: number;
  loaded: boolean;
}) {
  if (!loaded) return <div className="text-slate-500">…</div>;
  if (canvasWeight === undefined)
    return <div className="text-emerald-400">new · created on sync</div>;
  if (canvasWeight !== weight)
    return <div className="text-amber-400">{canvasWeight} → {weight} on sync</div>;
  return <div>{canvasWeight}</div>;
}

/**
 * One group: its name (renamed on leaving the field), weight, and ✕, which
 * removes an empty group at once and otherwise asks where its items go.
 */
function GroupRow({
  group,
  groups,
  files,
  canvasItems,
  canvas,
  setWeight,
}: {
  group: LocalAssignmentGroup;
  groups: LocalAssignmentGroup[];
  files: number | undefined;
  canvasItems: number | undefined;
  canvas: ReactNode;
  setWeight: (weight: number) => void;
}) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const move = useMoveAssignmentGroupMutation();
  const others = groups.filter((g) => g.id !== group.id);
  const [name, setName] = useState(group.name);
  const [moving, setMoving] = useState(false);
  const counted = files !== undefined && canvasItems !== undefined;
  const items = `${plural(files ?? 0, "file")} and ${plural(canvasItems ?? 0, "Canvas assignment")}`;

  const run = async (to?: string) => {
    setMoving(false);
    try {
      await move.mutateAsync({ settings, from: group, to });
      toast.success(
        to === undefined
          ? `Removed ${group.name}`
          : others.some((g) => g.name === to)
            ? `Moved ${group.name}'s ${items} to ${to}`
            : `Renamed ${group.name} to ${to}`,
      );
    } catch (e) {
      setName(group.name);
      showErrorToast(`Couldn't change ${group.name}: ${(e as Error).message}`);
    }
  };
  // a group's items go to another group, or to a new name (a rename)
  const moveTo = (typed: string, ask: boolean) => {
    const to = typed.trim();
    if (!to || to === group.name) return setMoving(false);
    const merging = others.some((g) => g.name === to);
    const question = `Move ${items} from ${group.name} to ${merging ? to : `a new group, ${to}`}, and remove ${group.name}?`;
    if (ask && !window.confirm(question)) return setName(group.name);
    run(to);
  };

  return (
    <>
      {moving ? (
        <>
          <input
            autoFocus
            list={`groups-${group.id}`}
            aria-label={`Move ${group.name}'s items to`}
            placeholder={`Move ${group.name}'s items to… (pick a group or type a new name)`}
            className={input}
            onChange={(e) => {
              // picking from the list, not typing
              const native = e.nativeEvent as InputEvent;
              if (!native.inputType || native.inputType === "insertReplacementText")
                moveTo(e.target.value, true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") moveTo(e.currentTarget.value, true);
              if (e.key === "Escape") setMoving(false);
            }}
            onBlur={(e) => !e.target.value && setMoving(false)}
          />
          <datalist id={`groups-${group.id}`}>
            {others.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </>
      ) : (
        <input
          aria-label="Group name"
          className={input}
          value={name}
          disabled={move.isPending}
          title="Renaming renames the group here, in Canvas and in its files"
          onChange={(e) => setName(e.target.value)}
          // renaming onto another group's name merges them, which asks first
          onBlur={() => moveTo(name, others.some((g) => g.name === name.trim()))}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      )}
      <input
        aria-label="Weight"
        className={input}
        value={group.weight.toString()}
        onChange={(e) => setWeight(parseInt(e.target.value || "0"))}
      />
      {canvas}
      <button
        title={
          !counted
            ? "Counting its items…"
            : files || canvasItems
              ? `Move ${group.name}'s ${items} to another group and remove it`
              : `Remove ${group.name}`
        }
        disabled={!counted || move.isPending}
        onClick={() => (moving ? setMoving(false) : files || canvasItems ? setMoving(true) : run())}
      >
        ✕
      </button>
    </>
  );
}
