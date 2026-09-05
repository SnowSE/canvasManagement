import { describe, it, expect } from "vitest";
import {
  studentDisplayName,
  studentFileToken,
  overrideMatches,
  resolveSchedule,
  scheduleToOverrides,
  studentLabels,
  unscheduledStudents,
} from "../assignments/models/utils/scheduleUtils";

const students = [
  { id: 1, sortableName: "Ginn, Landon" },
  { id: 2, sortableName: "Hoyt, Jonathan" },
  { id: 3, sortableName: "Smith, Alex" },
  { id: 4, sortableName: "Smith, Alex" },
];

describe("schedule utils", () => {
  it("adds the canvas id only to duplicate names", () => {
    const labels = studentLabels(students);
    expect(labels.get(1)).toBe("Ginn, Landon");
    expect(labels.get(3)).toBe("Smith, Alex (3)");
    expect(labels.get(4)).toBe("Smith, Alex (4)");
  });

  it("resolves names, flags unknown, ambiguous, and repeated students", () => {
    const { entries, unknown, duplicates } = resolveSchedule(
      [
        { date: "09/18/2026", students: ["Ginn, Landon", "Smith, Alex (4)", "Nobody, Here"] },
        { date: "10/09/2026", students: ["ginn, landon", "Smith, Alex"] },
      ],
      students
    );
    expect(entries[0].studentIds).toEqual([1, 4]);
    expect(entries[1].studentIds).toEqual([]);
    expect(unknown).toEqual(["Nobody, Here", "Smith, Alex"]);
    expect(duplicates).toEqual(["ginn, landon"]);
  });

  it("resolves bare canvas ids, which is what files store", () => {
    expect(studentFileToken(students[1])).toBe("2");
    const { entries, unknown } = resolveSchedule(
      [{ date: "09/18/2026", students: ["2", "4", "999"] }],
      students
    );
    expect(entries[0].studentIds).toEqual([2, 4]);
    expect(unknown).toEqual(["999"]);
    expect(studentDisplayName("2", students)).toBe("Hoyt, Jonathan");
    expect(studentDisplayName("4", students)).toBe("Smith, Alex (4)");
    expect(studentDisplayName("999", students)).toBe("999");
    expect(studentDisplayName("2", undefined)).toBe("2");
  });

  it("lists who has not been scheduled yet", () => {
    const left = unscheduledStudents(
      [{ date: "09/18/2026", students: ["Hoyt, Jonathan"] }],
      students
    );
    expect(left.map((s) => s.id)).toEqual([1, 3, 4]);
  });

  it("builds one override per date at the due time, keeping the lock distance", () => {
    const { overrides } = scheduleToOverrides(
      {
        dueAt: "12/11/2026 23:59:00",
        lockAt: "12/13/2026 23:59:00",
        unlockAt: "08/26/2026 08:00:00",
        schedule: [
          { date: "09/18/2026", students: ["Ginn, Landon", "Hoyt, Jonathan"] },
          { date: "10/09/2026", students: [] },
        ],
      },
      students
    );
    expect(overrides).toHaveLength(1);
    const o = overrides[0];
    expect(o.student_ids).toEqual([1, 2]);
    expect(new Date(o.due_at)).toEqual(new Date(2026, 8, 18, 23, 59, 0));
    expect(new Date(o.lock_at!)).toEqual(new Date(2026, 8, 20, 23, 59, 0));
    expect(new Date(o.unlock_at!)).toEqual(new Date(2026, 7, 26, 8, 0, 0));
    expect(
      overrideMatches({ student_ids: [2, 1], due_at: o.due_at }, o)
    ).toBe(true);
    expect(
      overrideMatches({ student_ids: [1], due_at: o.due_at }, o)
    ).toBe(false);
  });
});
