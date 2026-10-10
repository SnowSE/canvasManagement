import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTRPC } from "@/services/serverFunctions/trpcClient";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { showErrorToast } from "@/app/MyToaster";
import { getErrorMessage } from "@/services/utils/queryClient";
import { CourseItemType } from "@/features/local/course/courseItemTypes";

export const useGitStatusQuery = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery({
    ...trpc.git.status.queryOptions(courseName),
    // file saves also invalidate it (ClientCacheInvalidation); this catches
    // commits and fetches made outside the app
    refetchInterval: 30_000,
  });
};

const useInvalidateGit = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.git.status.queryKey(courseName),
      }),
      queryClient.invalidateQueries({ queryKey: trpc.git.itemHistory.queryKey() }),
    ]);
};

export const useGitCommitMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateGit();
  return useMutation(trpc.git.commit.mutationOptions({ onSettled: invalidate }));
};

export const useGitSetIdentityMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateGit();
  return useMutation(
    trpc.git.setIdentity.mutationOptions({ onSuccess: invalidate }),
  );
};

export const useGitSyncMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateGit();
  return useMutation(trpc.git.sync.mutationOptions({ onSettled: invalidate }));
};

export const useSetCommitOnPublishMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateGit();
  return useMutation(
    trpc.git.setCommitOnPublish.mutationOptions({ onSuccess: invalidate }),
  );
};

/**
 * Call after something was published to Canvas: when "commit after
 * publishing" is on, commits the course's changes with a message saying what
 * was published.
 */
export const useCommitAfterPublish = () => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const commit = useGitCommitMutation();

  return async (published: string) => {
    try {
      const { status, commitOnPublish } = await queryClient.fetchQuery({
        ...trpc.git.status.queryOptions(courseName),
        staleTime: 0,
      });
      if (!commitOnPublish || !status.available || status.changes.length === 0)
        return;
      const [, ...body] = status.suggestedMessage.split("\n");
      const message = `${courseName}: publish ${published} to Canvas\n${body.join("\n")}`;
      const sha = await commit.mutateAsync({ courseName, message });
      toast.success(`Committed ${sha}: publish ${published}`, { duration: 4000 });
    } catch (e) {
      showErrorToast(`Published, but the commit afterwards failed: ${getErrorMessage(e)}`);
    }
  };
};

export interface ItemRefInput {
  moduleName: string;
  type: CourseItemType;
  name: string;
}

export const useItemHistoryQuery = (item: ItemRefInput) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery(trpc.git.itemHistory.queryOptions({ courseName, ...item }));
};

export const useItemAtCommitQuery = (
  item: ItemRefInput,
  commit: { sha: string; path: string } | undefined,
) => {
  const { courseName } = useCourseContext();
  const trpc = useTRPC();
  return useQuery({
    ...trpc.git.itemAtCommit.queryOptions({
      courseName,
      ...item,
      sha: commit?.sha ?? "",
      path: commit?.path ?? "",
    }),
    enabled: commit !== undefined,
    staleTime: Infinity,
  });
};

export const useRestoreItemMutation = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateGit();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.git.restoreItem.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        // the file changed on disk; refresh everything that reads it
        await queryClient.invalidateQueries();
      },
    }),
  );
};
