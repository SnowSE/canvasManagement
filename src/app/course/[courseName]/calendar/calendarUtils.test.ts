import { describe, expect, it } from "vitest";
import { getWeekNumber, isMonthPast } from "./calendarMonthUtils";


// months are 0 based, days are 1 based
describe("testing week numbers", () => {

  it("can get before first day", () => {
    const startDate = new Date(2024, 8, 3);
    const firstDayOfFirstWeek = new Date(2024, 8, 1);

    const weekNumber = getWeekNumber(startDate, firstDayOfFirstWeek);
    expect(weekNumber).toBe(1);
  });

  it("can get end of first week", () => {
    const startDate = new Date(2024, 8, 3);
    const firstDayOfFirstWeek = new Date(2024, 8, 7);

    const weekNumber = getWeekNumber(startDate, firstDayOfFirstWeek);
    expect(weekNumber).toBe(1);
  });

  it("can get start of second week", () => {
    const startDate = new Date(2024, 8, 3);
    const firstDayOfFirstWeek = new Date(2024, 8, 8);

    const weekNumber = getWeekNumber(startDate, firstDayOfFirstWeek);
    expect(weekNumber).toBe(2);
  });

  it("can get start of third week", () => {
    const startDate = new Date(2024, 8, 3);
    const firstDayOfFirstWeek = new Date(2024, 8, 15);

    const weekNumber = getWeekNumber(startDate, firstDayOfFirstWeek);
    expect(weekNumber).toBe(3);
  });
  it("can get previous week", () => {
    const startDate = new Date(2024, 8, 3);
    const firstDayOfFirstWeek = new Date(2024, 7, 29);

    const weekNumber = getWeekNumber(startDate, firstDayOfFirstWeek);
    expect(weekNumber).toBe(-1);
  });

});

describe("testing month collapsing", () => {
  const startDate = new Date(2026, 7, 26);
  const august = { year: 2026, month: 8 };

  it("stays expanded during the month", () => {
    expect(isMonthPast(startDate, august, new Date(2026, 7, 31))).toBe(false);
  });

  it("stays expanded through the first week of the next month", () => {
    expect(isMonthPast(startDate, august, new Date(2026, 8, 5))).toBe(false);
  });

  it("collapses once the second week of the next month starts", () => {
    expect(isMonthPast(startDate, august, new Date(2026, 8, 6))).toBe(true);
  });

  it("stays collapsed later in the next month", () => {
    expect(isMonthPast(startDate, august, new Date(2026, 8, 20))).toBe(true);
  });

  it("stays expanded before the month starts", () => {
    expect(isMonthPast(startDate, { year: 2026, month: 9 }, new Date(2026, 8, 20))).toBe(false);
  });

  it("rolls over the year", () => {
    const decemberStart = new Date(2026, 11, 1);
    const december = { year: 2026, month: 12 };
    expect(isMonthPast(decemberStart, december, new Date(2027, 0, 2))).toBe(false);
    expect(isMonthPast(decemberStart, december, new Date(2027, 0, 3))).toBe(true);
  });
});
