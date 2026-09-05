// Server-memory cache of each course's Canvas roster and group sets.
// Canvas is the source of truth; nothing here is written to disk. A course's
// entries are filled the first time something asks for them after the server
// starts, and replaced by the explicit sync mutations.
import { canvasService } from "../services/canvasService";
import { canvasGroupService } from "../services/canvasGroupService";
import {
  GroupSetsSnapshot,
  RosterGroupSet,
  RosterStudent,
  StudentsSnapshot,
} from "./rosterModels";

const studentsByCourse = new Map<number, StudentsSnapshot>();
const groupSetsByCourse = new Map<number, GroupSetsSnapshot>();
// dedupe concurrent first loads (several editors can mount at once)
const pendingStudents = new Map<number, Promise<StudentsSnapshot>>();
const pendingGroupSets = new Map<number, Promise<GroupSetsSnapshot>>();

async function loadStudents(canvasCourseId: number): Promise<StudentsSnapshot> {
  const canvasStudents = await canvasService.getEnrolledStudents(canvasCourseId);
  const seen = new Set<number>();
  const students: RosterStudent[] = canvasStudents
    .filter((s) => {
      // a student in two sections is returned once per section
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
      sortableName: s.sortable_name,
      email: s.email ?? "",
    }))
    .sort((a, b) => a.sortableName.localeCompare(b.sortableName));
  const snapshot = { students, syncedAt: new Date().toISOString() };
  studentsByCourse.set(canvasCourseId, snapshot);
  return snapshot;
}

async function loadGroupSets(
  canvasCourseId: number
): Promise<GroupSetsSnapshot> {
  const categories =
    await canvasGroupService.getGroupCategories(canvasCourseId);
  const groupSets: RosterGroupSet[] = await Promise.all(
    categories.map(async (category) => {
      const groups = await canvasGroupService.getGroupsInCategory(category.id);
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          const users = await canvasGroupService.getGroupUsers(group.id);
          return {
            id: group.id,
            name: group.name,
            members: users
              .map((u) => ({ id: u.id, sortableName: u.sortable_name }))
              .sort((a, b) => a.sortableName.localeCompare(b.sortableName)),
          };
        })
      );
      return {
        id: category.id,
        name: category.name,
        groups: groupsWithMembers.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        ),
      };
    })
  );
  const snapshot = {
    groupSets: groupSets.sort((a, b) => a.name.localeCompare(b.name)),
    syncedAt: new Date().toISOString(),
  };
  groupSetsByCourse.set(canvasCourseId, snapshot);
  return snapshot;
}

function once<T>(
  pending: Map<number, Promise<T>>,
  key: number,
  load: () => Promise<T>
): Promise<T> {
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const promise = load().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

export const rosterCache = {
  async getStudents(canvasCourseId: number): Promise<StudentsSnapshot> {
    return (
      studentsByCourse.get(canvasCourseId) ??
      (await once(pendingStudents, canvasCourseId, () =>
        loadStudents(canvasCourseId)
      ))
    );
  },
  async refreshStudents(canvasCourseId: number): Promise<StudentsSnapshot> {
    return await once(pendingStudents, canvasCourseId, () =>
      loadStudents(canvasCourseId)
    );
  },
  async getGroupSets(canvasCourseId: number): Promise<GroupSetsSnapshot> {
    return (
      groupSetsByCourse.get(canvasCourseId) ??
      (await once(pendingGroupSets, canvasCourseId, () =>
        loadGroupSets(canvasCourseId)
      ))
    );
  },
  async refreshGroupSets(canvasCourseId: number): Promise<GroupSetsSnapshot> {
    return await once(pendingGroupSets, canvasCourseId, () =>
      loadGroupSets(canvasCourseId)
    );
  },
};
