import { describe, it, expect, vi } from "vitest";
import { updateEach } from "./updateEach";

describe("updateEach", () => {
  it("updates the items one at a time, reporting progress", async () => {
    const order: string[] = [];
    const progress = vi.fn();

    await updateEach(["a", "b"], async (item) => void order.push(item), progress);

    expect(order).toEqual(["a", "b"]);
    expect(progress.mock.calls).toEqual([[1], [2]]);
  });

  it("goes on past an item that fails, and says which failed", async () => {
    const failed = await updateEach(
      ["a", "b", "c"],
      async (item) => {
        if (item === "b") throw new Error("Canvas said no");
      },
      () => {},
    );

    expect(failed).toEqual(["b"]);
  });
});
