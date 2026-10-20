import { describe, it, expect } from "vitest";
import { exposureOf } from "./networkExposure";

describe("exposureOf", () => {
  it("is local when the compose file publishes it on 127.0.0.1", () => {
    expect(exposureOf({ CANVAS_MANAGER_ADDRESS: "127.0.0.1", CANVAS_MANAGER_PORT: "8082" }, true)).toEqual({
      kind: "local",
      address: "127.0.0.1",
      port: "8082",
    });
  });

  it("is open to the network on 0.0.0.0 or any other address", () => {
    expect(exposureOf({ CANVAS_MANAGER_ADDRESS: "0.0.0.0" }, true)?.kind).toBe("network");
    expect(exposureOf({ CANVAS_MANAGER_ADDRESS: "192.168.1.20" }, true)?.kind).toBe("network");
  });

  it("is unknown in a container whose compose file doesn't say (made before the address was passed in)", () => {
    expect(exposureOf({ CANVAS_MANAGER_PORT: "3000" }, true)).toEqual({ kind: "unknown", port: "3000" });
  });

  it("says nothing outside a container, where there's no compose file", () => {
    expect(exposureOf({}, false)).toBeUndefined();
  });
});
