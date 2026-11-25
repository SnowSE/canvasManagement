import { describe, expect, it } from "vitest";
import { rowRoom } from "./measureRow";

// a row 1132 wide: its start bar (23), three panes, its end bar (23), 2 between each
const bars = { start: 23, end: 23 };
const measured = (panesRight: number) => rowRoom({ rowLeft: 10, rowWidth: 1132, panesRight: 10 + panesRight, bars, gap: 2, shown: 3 });

describe("the room a row has, from where its parts are on the page", () => {
  it("the empty room is from the last pane to where the end bar sits at the row's right end: the end bar and its gap, nothing else", () => {
    // panes end at 1107: then a gap, the end bar, and the row's end
    expect(measured(1107).free).toBe(0);
    expect(measured(1007).free).toBe(100);
  });
  it("is below zero by as much as the panes run past that", () => {
    expect(measured(1127).free).toBe(-20);
  });
  it("the start bar takes none of it: it is to the left of the panes, already behind where they end", () => {
    const wider = rowRoom({ rowLeft: 10, rowWidth: 1132, panesRight: 10 + 1107, bars: { start: 60, end: 23 }, gap: 2, shown: 3 });
    expect(wider.free).toBe(0);
  });
  it("the panes share the row less both bars, a gap beside each, and the gaps between the panes", () => {
    expect(measured(1107).shared).toBe(1132 - 2 * (23 + 2) - 2 * 2);
    expect(rowRoom({ rowLeft: 0, rowWidth: 1000, panesRight: 0, bars: { start: 0, end: 0 }, gap: 2, shown: 0 }).shared).toBe(1000);
  });
  it("a row with no bars has the whole row", () => {
    expect(rowRoom({ rowLeft: 0, rowWidth: 1000, panesRight: 900, bars: { start: 0, end: 0 }, gap: 2, shown: 2 }).free).toBe(100);
  });
});
