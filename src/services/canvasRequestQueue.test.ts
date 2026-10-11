import { describe, expect, it } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { createCanvasRequestQueue, isRateLimitError } from "./canvasRequestQueue";

const config = (data?: unknown) =>
  ({ method: "post", url: "https://canvas/x", data }) as InternalAxiosRequestConfig;

const ok = (remaining?: number) =>
  ({
    status: 200,
    data: {},
    headers:
      remaining === undefined ? {} : { "x-rate-limit-remaining": String(remaining) },
  }) as unknown as AxiosResponse;

const rateLimited = (headers: Record<string, string> = {}) =>
  Object.assign(new Error("429"), {
    response: { status: 429, data: "429 Too Many Requests (Rate Limit Exceeded)", headers },
  });

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
  };
}

describe("isRateLimitError", () => {
  it("recognizes 429 and Canvas's older 403 rate limit", () => {
    expect(isRateLimitError(rateLimited())).toBe(true);
    expect(
      isRateLimitError({
        response: { status: 403, data: "403 Forbidden (Rate Limit Exceeded)" },
      }),
    ).toBe(true);
    expect(
      isRateLimitError({ response: { status: 403, data: { errors: ["no access"] } } }),
    ).toBe(false);
    expect(isRateLimitError({ response: { status: 404, data: {} } })).toBe(false);
  });
});

describe("createCanvasRequestQueue", () => {
  it("runs at most maxConcurrent requests at once", async () => {
    const queue = createCanvasRequestQueue({ maxConcurrent: 2, log: () => {} });
    let inFlight = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const send = () =>
      new Promise<AxiosResponse>((resolve) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        releases.push(() => {
          inFlight--;
          resolve(ok());
        });
      });

    const all = Promise.all(
      Array.from({ length: 5 }, () => queue.run(config(), send)),
    );
    await tick();
    expect(inFlight).toBe(2);
    while (releases.length) {
      releases.shift()!();
      await tick();
    }
    await all;
    expect(peak).toBe(2);
  });

  it("drops to one at a time when the rate limit budget is low", async () => {
    const queue = createCanvasRequestQueue({
      maxConcurrent: 3,
      lowBudget: 100,
      log: () => {},
    });
    await queue.run(config(), async () => ok(50));
    let inFlight = 0;
    let peak = 0;
    const send = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
      return ok(50);
    };
    await Promise.all(Array.from({ length: 4 }, () => queue.run(config(), send)));
    expect(peak).toBe(1);
  });

  it("retries a rate-limited request after backing off", async () => {
    const clock = fakeClock();
    const queue = createCanvasRequestQueue({ ...clock, log: () => {} });
    let calls = 0;
    const response = await queue.run(config('{"a":1}'), async () => {
      calls++;
      if (calls < 3) throw rateLimited();
      return ok(600);
    });
    expect(response.status).toBe(200);
    expect(calls).toBe(3);
    expect(clock.sleeps).toHaveLength(2);
    expect(clock.sleeps[1]).toBeGreaterThan(clock.sleeps[0] - 1000);
  });

  it("honors Retry-After", async () => {
    const clock = fakeClock();
    const queue = createCanvasRequestQueue({ ...clock, log: () => {} });
    let calls = 0;
    await queue.run(config(), async () => {
      if (calls++ === 0) throw rateLimited({ "retry-after": "5" });
      return ok();
    });
    expect(clock.sleeps).toEqual([5000]);
  });

  it("gives up after maxRetries", async () => {
    const clock = fakeClock();
    const queue = createCanvasRequestQueue({ ...clock, maxRetries: 2, log: () => {} });
    let calls = 0;
    await expect(
      queue.run(config(), async () => {
        calls++;
        throw rateLimited();
      }),
    ).rejects.toThrow("429");
    expect(calls).toBe(3);
  });

  it("does not retry other errors or bodies that can't be resent", async () => {
    const queue = createCanvasRequestQueue({ log: () => {} });
    let calls = 0;
    const notFound = Object.assign(new Error("404"), {
      response: { status: 404, data: {}, headers: {} },
    });
    await expect(
      queue.run(config(), async () => {
        calls++;
        throw notFound;
      }),
    ).rejects.toThrow("404");
    await expect(
      queue.run(config({ pipe: () => {} }), async () => {
        calls++;
        throw rateLimited();
      }),
    ).rejects.toThrow("429");
    expect(calls).toBe(2);
    expect(queue.state().active).toBe(0);
  });
});
