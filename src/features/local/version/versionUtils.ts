import { CommitSummary } from "./versionModels";

export const GITHUB_REPO = "SnowSE/canvasManagement";

export const shortenSha = (sha: string) => sha.slice(0, 7);

type ManifestDescriptor = {
  digest: string;
  mediaType?: string;
  platform?: { architecture?: string; os?: string };
};

// A tag may point at a single-platform manifest or at an index/list of
// per-platform manifests (buildx also adds attestation entries with
// architecture "unknown"). Return the digest of the manifest we should
// read the image config from, or null when the input is already a manifest.
export const pickPlatformManifestDigest = (
  manifestOrIndex: unknown,
  preferred = { os: "linux", architecture: "amd64" },
): string | null => {
  if (
    typeof manifestOrIndex !== "object" ||
    manifestOrIndex === null ||
    !("manifests" in manifestOrIndex) ||
    !Array.isArray(manifestOrIndex.manifests)
  ) {
    return null;
  }
  const entries = (manifestOrIndex.manifests as ManifestDescriptor[]).filter(
    (m) => m.platform?.architecture !== "unknown",
  );
  const exact = entries.find(
    (m) =>
      m.platform?.os === preferred.os &&
      m.platform?.architecture === preferred.architecture,
  );
  return (exact ?? entries[0])?.digest ?? null;
};

export const getLabelsFromImageConfig = (
  imageConfig: unknown,
): Record<string, string> => {
  if (typeof imageConfig !== "object" || imageConfig === null) return {};
  const config = (imageConfig as { config?: { Labels?: unknown } }).config;
  const labels = config?.Labels;
  if (typeof labels !== "object" || labels === null) return {};
  return Object.fromEntries(
    Object.entries(labels as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

type GithubCompareCommit = {
  sha: string;
  html_url: string;
  parents?: { sha: string }[];
  commit: {
    message: string;
    author?: { name?: string; date?: string } | null;
  };
};

// Turn the GitHub compare payload into a display list: newest first, first
// line of each message only, merge commits dropped since they duplicate the
// commits they merged.
export const summarizeCompareCommits = (
  commits: GithubCompareCommit[],
): CommitSummary[] => {
  return commits
    .filter((c) => (c.parents?.length ?? 1) <= 1)
    .map((c) => ({
      sha: c.sha,
      shortSha: shortenSha(c.sha),
      message: c.commit.message.split("\n")[0].trim(),
      url: c.html_url,
      date: c.commit.author?.date ?? null,
      author: c.commit.author?.name ?? null,
    }))
    .reverse();
};

export const getCompareUrl = (fromSha: string, toSha: string) =>
  `https://github.com/${GITHUB_REPO}/compare/${fromSha}...${toSha}`;
