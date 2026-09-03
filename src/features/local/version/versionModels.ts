export type RunningVersion = {
  gitSha: string;
  shortSha: string;
  buildDate: string | null;
  image: string;
  tag: string;
};

export type PublishedVersion = {
  gitSha: string | null;
  shortSha: string | null;
  buildDate: string | null;
  digest: string;
};

export type CommitSummary = {
  sha: string;
  shortSha: string;
  message: string;
  url: string;
  date: string | null;
  author: string | null;
};

export type VersionStatus =
  | { kind: "disabled"; reason: string }
  | {
      kind: "current";
      running: RunningVersion;
      published: PublishedVersion;
      checkedAt: string;
    }
  | {
      kind: "update-available";
      running: RunningVersion;
      published: PublishedVersion;
      commits: CommitSummary[];
      aheadBy: number | null;
      compareUrl: string;
      checkedAt: string;
    }
  | {
      kind: "error";
      running: RunningVersion;
      message: string;
      checkedAt: string;
    };
