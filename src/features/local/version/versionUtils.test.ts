import { describe, it, expect } from "vitest";
import {
  getLabelsFromImageConfig,
  pickPlatformManifestDigest,
  summarizeCompareCommits,
} from "./versionUtils";

describe("pickPlatformManifestDigest", () => {
  it("returns null for a plain (non-index) manifest", () => {
    expect(
      pickPlatformManifestDigest({ config: { digest: "sha256:abc" } }),
    ).toBeNull();
  });

  it("prefers linux/amd64 and skips attestation entries", () => {
    const index = {
      manifests: [
        { digest: "sha256:att", platform: { architecture: "unknown", os: "unknown" } },
        { digest: "sha256:arm", platform: { architecture: "arm64", os: "linux" } },
        { digest: "sha256:amd", platform: { architecture: "amd64", os: "linux" } },
      ],
    };
    expect(pickPlatformManifestDigest(index)).toBe("sha256:amd");
  });

  it("falls back to the first real entry when the preferred platform is missing", () => {
    const index = {
      manifests: [
        { digest: "sha256:att", platform: { architecture: "unknown" } },
        { digest: "sha256:arm", platform: { architecture: "arm64", os: "linux" } },
      ],
    };
    expect(pickPlatformManifestDigest(index)).toBe("sha256:arm");
  });
});

describe("getLabelsFromImageConfig", () => {
  it("reads string labels off the image config", () => {
    const labels = getLabelsFromImageConfig({
      config: {
        Labels: {
          "org.opencontainers.image.revision": "abc123",
          weird: 5,
        },
      },
    });
    expect(labels).toEqual({ "org.opencontainers.image.revision": "abc123" });
  });

  it("returns an empty object when labels are missing", () => {
    expect(getLabelsFromImageConfig({ config: {} })).toEqual({});
    expect(getLabelsFromImageConfig(null)).toEqual({});
  });
});

describe("summarizeCompareCommits", () => {
  it("drops merge commits, keeps the first message line, newest first", () => {
    const commits = summarizeCompareCommits([
      {
        sha: "1111111aaaa",
        html_url: "u1",
        parents: [{ sha: "0" }],
        commit: {
          message: "First change\n\nLong body here",
          author: { name: "A", date: "2026-09-01T00:00:00Z" },
        },
      },
      {
        sha: "2222222bbbb",
        html_url: "u2",
        parents: [{ sha: "1" }, { sha: "x" }],
        commit: { message: "Merge pull request #1", author: null },
      },
      {
        sha: "3333333cccc",
        html_url: "u3",
        parents: [{ sha: "2" }],
        commit: { message: "Second change", author: { name: "B" } },
      },
    ]);
    expect(commits.map((c) => c.shortSha)).toEqual(["3333333", "1111111"]);
    expect(commits[1]).toMatchObject({
      message: "First change",
      author: "A",
      date: "2026-09-01T00:00:00Z",
      url: "u1",
    });
    expect(commits[0].date).toBeNull();
  });
});
