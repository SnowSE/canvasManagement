import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

/**
 * Every Canvas API request on the server goes through one of these, so a burst
 * (several "Add to Canvas" clicks in a row, a 60 question quiz) waits its turn
 * instead of tripping Canvas's rate limit.
 *
 * Canvas throttles each token with a leaky bucket and reports what is left in
 * `X-Rate-Limit-Remaining`. The queue runs a few requests at a time, drops to
 * one at a time when the bucket runs low, and when Canvas still says no (429,
 * or the older 403 "Rate Limit Exceeded") it pauses every request, not just
 * the one that failed, and retries it.
 */
export interface CanvasRequestQueueOptions {
  maxConcurrent: number;
  /** Below this much X-Rate-Limit-Remaining, run one request at a time. */
  lowBudget: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
}

export const defaultCanvasRequestQueueOptions: CanvasRequestQueueOptions = {
  maxConcurrent: 3,
  lowBudget: 200,
  maxRetries: 8,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
};

type HeaderSource = { headers?: unknown } | undefined;

function header(source: HeaderSource, name: string): string | undefined {
  const headers = source?.headers as
    | { get?: (n: string) => unknown; [key: string]: unknown }
    | undefined;
  if (!headers) return undefined;
  const value =
    typeof headers.get === "function" ? headers.get(name) : headers[name];
  return value === undefined || value === null ? undefined : String(value);
}

export function isRateLimitError(error: unknown): error is AxiosError {
  const response = (error as AxiosError | undefined)?.response;
  if (!response) return false;
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  const body =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data ?? "");
  return body.includes("Rate Limit Exceeded");
}

/** A body we can send again; a form-data stream is used up by the first try. */
function canResend(config: InternalAxiosRequestConfig | undefined) {
  const data = config?.data;
  return (
    data === undefined ||
    data === null ||
    typeof data === "string" ||
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data)
  );
}

export function createCanvasRequestQueue(
  options: Partial<CanvasRequestQueueOptions> = {},
) {
  const {
    maxConcurrent,
    lowBudget,
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    now = Date.now,
    log = console.info,
  } = { ...defaultCanvasRequestQueueOptions, ...options };

  let active = 0;
  let pausedUntil = 0;
  let remaining: number | undefined;
  const waiting: (() => void)[] = [];

  const limit = () =>
    remaining !== undefined && remaining < lowBudget ? 1 : maxConcurrent;

  const wakeNext = () => waiting.shift()?.();

  async function acquire() {
    for (;;) {
      const pause = pausedUntil - now();
      if (pause > 0) {
        await sleep(pause);
        continue;
      }
      if (active < limit()) {
        active++;
        if (active < limit()) wakeNext();
        return;
      }
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
  }

  function release() {
    active--;
    wakeNext();
  }

  function observe(source: HeaderSource) {
    const value = Number(header(source, "x-rate-limit-remaining"));
    if (Number.isFinite(value)) remaining = value;
  }

  function retryDelay(error: AxiosError, attempt: number) {
    const retryAfter = Number(header(error.response, "retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0)
      return Math.min(retryAfter * 1000, maxDelayMs);
    const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    return backoff + Math.random() * baseDelayMs;
  }

  async function run(
    config: InternalAxiosRequestConfig,
    send: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>,
  ): Promise<AxiosResponse> {
    for (let attempt = 0; ; attempt++) {
      await acquire();
      try {
        const response = await send(config);
        observe(response);
        return response;
      } catch (error) {
        observe((error as AxiosError).response);
        if (
          !isRateLimitError(error) ||
          attempt >= maxRetries ||
          !canResend(config)
        )
          throw error;
        // the bucket is per token, so every queued request waits, not just this one
        remaining = 0;
        const delay = retryDelay(error, attempt);
        pausedUntil = Math.max(pausedUntil, now() + delay);
        log(
          `Canvas rate limit on ${config.method?.toUpperCase()} ${config.url}, ` +
            `pausing ${(delay / 1000).toFixed(1)}s (retry ${attempt + 1}/${maxRetries})`,
        );
      } finally {
        release();
      }
    }
  }

  return {
    run,
    /** For tests and logging. */
    state: () => ({ active, waiting: waiting.length, remaining, pausedUntil }),
  };
}
