import { describe, it, expect } from "vitest";
import { isAllowedRequest } from "./requestGuard";

const request = (headers: Record<string, string>) => new Headers(headers);
const allowed = (headers: Record<string, string>, extraHosts: string[] = []) =>
  isAllowedRequest(request(headers), extraHosts);

describe("isAllowedRequest", () => {
  it("allows the app's own pages", () => {
    expect(
      allowed({ host: "localhost:8082", origin: "http://localhost:8082", "sec-fetch-site": "same-origin" })
    ).toBe(true);
    expect(allowed({ host: "127.0.0.1:8082", "sec-fetch-site": "same-origin" })).toBe(true);
  });

  it("allows programs that aren't browsers (no browser headers)", () => {
    expect(allowed({ host: "localhost:8082" })).toBe(true);
  });

  it("refuses a request a website made the browser send", () => {
    expect(
      allowed({ host: "localhost:8082", origin: "https://example.com", "sec-fetch-site": "cross-site" })
    ).toBe(false);
  });

  it("refuses another app on this computer, which browsers count as the same site", () => {
    expect(
      allowed({ host: "localhost:8082", origin: "http://localhost:5173", "sec-fetch-site": "same-site" })
    ).toBe(false);
  });

  it("refuses a request whose Origin doesn't match even without Sec-Fetch-Site", () => {
    expect(allowed({ host: "localhost:8082", origin: "http://localhost:5173" })).toBe(false);
  });

  it("refuses a sandboxed frame's null Origin", () => {
    expect(allowed({ host: "localhost:8082", origin: "null" })).toBe(false);
  });

  it("refuses a hostname that only points at this computer (DNS rebinding)", () => {
    expect(
      allowed({ host: "evil.example:8082", origin: "http://evil.example:8082", "sec-fetch-site": "same-origin" })
    ).toBe(false);
  });

  it("allows opening it from another machine by IP or local network name", () => {
    for (const host of ["192.168.1.20:3000", "teaching-server:3000", "nas.local:3000", "[::1]:3000"])
      expect(allowed({ host, origin: `http://${host}`, "sec-fetch-site": "same-origin" })).toBe(true);
  });

  it("allows a domain name listed in CANVAS_MANAGER_HOSTS", () => {
    const host = "canvas.example.edu";
    expect(allowed({ host, origin: `https://${host}` })).toBe(false);
    expect(allowed({ host, origin: `https://${host}` }, [host])).toBe(true);
  });

  it("trusts Sec-Fetch-Site over Origin, so a proxy that rewrites Host keeps working", () => {
    const behindProxy = { host: "localhost:3000", origin: "https://canvas.example.edu" };
    expect(allowed({ ...behindProxy, "sec-fetch-site": "same-origin" })).toBe(true);
    expect(allowed({ ...behindProxy, "sec-fetch-site": "cross-site" })).toBe(false);
  });
});

describe("refusal", () => {
  it("only guards /api requests", async () => {
    const { refusal } = await import("./requestGuard");
    const crossSite = { host: "localhost:3000", origin: "https://example.com", "sec-fetch-site": "cross-site" };

    expect(refusal(new Request("http://localhost:3000/api/trpc/x", { headers: crossSite }))?.status).toBe(403);
    expect(refusal(new Request("http://localhost:3000/course/x", { headers: crossSite }))).toBeUndefined();
  });
});
