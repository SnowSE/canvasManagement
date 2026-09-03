import {
  PublishedVersion,
  RunningVersion,
  VersionStatus,
} from "./versionModels";
import {
  GITHUB_REPO,
  getCompareUrl,
  getLabelsFromImageConfig,
  pickPlatformManifestDigest,
  shortenSha,
  summarizeCompareCommits,
} from "./versionUtils";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RETRY_AFTER_ERROR_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

const getRunningVersion = (): RunningVersion | null => {
  const gitSha = process.env.GIT_SHA?.trim();
  if (!gitSha) return null;
  return {
    gitSha,
    shortSha: shortenSha(gitSha),
    buildDate: process.env.BUILD_DATE?.trim() || null,
    image: process.env.UPDATE_CHECK_IMAGE?.trim() || "snowcollege/canvas_management",
    tag: process.env.UPDATE_CHECK_TAG?.trim() || "latest",
  };
};

const fetchJson = async <T>(
  url: string,
  init: RequestInit = {},
): Promise<{ body: T; headers: Headers }> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  return { body: (await response.json()) as T, headers: response.headers };
};

// Docker Hub's tags API does not expose image labels, so go through the
// registry: anonymous pull token -> manifest for the tag -> image config blob.
const fetchPublishedVersion = async (
  image: string,
  tag: string,
): Promise<PublishedVersion> => {
  const { body: tokenBody } = await fetchJson<{ token: string }>(
    `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${image}:pull`,
  );
  const auth = { Authorization: `Bearer ${tokenBody.token}` };
  const registry = `https://registry-1.docker.io/v2/${image}`;

  const manifestResponse = await fetchJson<unknown>(
    `${registry}/manifests/${tag}`,
    { headers: { ...auth, Accept: MANIFEST_ACCEPT } },
  );
  const digest =
    manifestResponse.headers.get("docker-content-digest") ?? "unknown";

  let manifest = manifestResponse.body;
  const platformDigest = pickPlatformManifestDigest(manifest);
  if (platformDigest) {
    manifest = (
      await fetchJson<unknown>(`${registry}/manifests/${platformDigest}`, {
        headers: { ...auth, Accept: MANIFEST_ACCEPT },
      })
    ).body;
  }

  const configDigest = (manifest as { config?: { digest?: string } }).config
    ?.digest;
  if (!configDigest) {
    throw new Error(`manifest for ${image}:${tag} has no config digest`);
  }

  // the blob request redirects to a CDN; fetch drops the Authorization header
  // on the cross-origin hop, which is what the registry expects
  const { body: imageConfig } = await fetchJson<unknown>(
    `${registry}/blobs/${configDigest}`,
    { headers: auth },
  );
  const labels = getLabelsFromImageConfig(imageConfig);
  const gitSha = labels["org.opencontainers.image.revision"] || null;

  return {
    gitSha,
    shortSha: gitSha ? shortenSha(gitSha) : null,
    buildDate: labels["org.opencontainers.image.created"] || null,
    digest,
  };
};

type GithubCompare = {
  ahead_by?: number;
  commits: Parameters<typeof summarizeCompareCommits>[0];
};

const fetchWhatsNew = async (fromSha: string, toSha: string) => {
  try {
    const { body } = await fetchJson<GithubCompare>(
      `https://api.github.com/repos/${GITHUB_REPO}/compare/${fromSha}...${toSha}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "canvas-manager-update-check",
        },
      },
    );
    return {
      commits: summarizeCompareCommits(body.commits ?? []),
      aheadBy: body.ahead_by ?? null,
    };
  } catch (e) {
    // the update indicator is still useful without the commit list
    console.warn("Canvas Manager update check: could not load changes", e);
    return { commits: [], aheadBy: null };
  }
};

const checkForUpdate = async (
  running: RunningVersion,
): Promise<VersionStatus> => {
  const checkedAt = new Date().toISOString();
  try {
    const published = await fetchPublishedVersion(running.image, running.tag);
    if (!published.gitSha || published.gitSha === running.gitSha) {
      return { kind: "current", running, published, checkedAt };
    }
    const { commits, aheadBy } = await fetchWhatsNew(
      running.gitSha,
      published.gitSha,
    );
    return {
      kind: "update-available",
      running,
      published,
      commits,
      aheadBy,
      compareUrl: getCompareUrl(running.gitSha, published.gitSha),
      checkedAt,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("Canvas Manager update check failed:", message);
    return { kind: "error", running, message, checkedAt };
  }
};

let cached: { status: VersionStatus; expiresAt: number } | undefined;
let inFlight: Promise<VersionStatus> | undefined;

export const getVersionStatus = async (): Promise<VersionStatus> => {
  if (process.env.DISABLE_UPDATE_CHECK === "true") {
    return { kind: "disabled", reason: "DISABLE_UPDATE_CHECK is set" };
  }
  const running = getRunningVersion();
  if (!running) {
    return {
      kind: "disabled",
      reason: "no GIT_SHA baked into this build (local dev?)",
    };
  }

  if (cached && cached.expiresAt > Date.now()) return cached.status;
  if (inFlight) return inFlight;

  inFlight = checkForUpdate(running)
    .then((status) => {
      // keep a known-good answer around when a later check fails
      const keepPrevious =
        status.kind === "error" && cached && cached.status.kind !== "error";
      cached = {
        status: keepPrevious ? cached!.status : status,
        expiresAt:
          Date.now() +
          (status.kind === "error" ? RETRY_AFTER_ERROR_MS : CHECK_INTERVAL_MS),
      };
      return cached.status;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
};
