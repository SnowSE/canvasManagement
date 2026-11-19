"use client";

import { useTRPC } from "@/services/serverFunctions/trpcClient";
import React, { useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalSettingsQuery } from "@/features/local/globalSettings/globalSettingsHooks";
import { GlobalSettings } from "@/features/local/globalSettings/globalSettingsModels";

interface ServerToClientEvents {
  message: (data: string) => void;
  /** The files changed within a moment, each once (see websocket-standalone.js). */
  filesChanged: (filePaths: string[]) => void;
  folderChanged: (folderPath: string) => void;
}

interface ClientToServerEvents {
  sendMessage: (data: string) => void;
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io("/");

function removeFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex > 0) {
    return fileName.substring(0, lastDotIndex);
  }
  return fileName;
}

function getCourseNameByPath(
  filePath: string,
  settings: GlobalSettings
) {
  const courseSettings = settings.courses.find((c) => {
    const normalizedFilePath = filePath.startsWith("./")
      ? filePath.substring(2)
      : filePath;
    const normalizedCoursePath = c.path.startsWith("./")
      ? c.path.substring(2)
      : c.path;
    return normalizedFilePath.startsWith(normalizedCoursePath);
  });
  return courseSettings?.name;
}

export function ClientCacheInvalidation() {
  const invalidateCache = useFilePathInvalidation();
  const invalidateModuleNames = useModuleNamesInvalidation();
  const queryClient = useQueryClient();
  // io() connects on its own and keeps trying after a connection error (the
  // server restarting, the machine waking); the file changes it missed while
  // disconnected are caught up by refetching everything on reconnect
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected successfully.");
    });
    const catchUp = () => {
      console.log("Socket reconnected: refetching everything");
      queryClient.invalidateQueries();
    };
    socket.io.on("reconnect", catchUp);

    socket.on("message", (data) => {
      console.log("Received message:", data);
    });

    socket.on("filesChanged", invalidateCache);
    socket.on("folderChanged", invalidateModuleNames);

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    return () => {
      socket.io.off("reconnect", catchUp);
      socket.off("connect");
      socket.off("message");
      socket.off("filesChanged");
      socket.off("folderChanged");
      socket.off("connect_error");
    };
  }, [invalidateCache, invalidateModuleNames, queryClient]);

  return <></>;
}

const useModuleNamesInvalidation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: settings } = useGlobalSettingsQuery();

  return useCallback(
    (folderPath: string) => {
      const courseName = getCourseNameByPath(folderPath, settings);
      if (!courseName) return;
      queryClient.invalidateQueries({
        queryKey: trpc.module.getModuleNames.queryKey(courseName),
      });
    },
    [queryClient, trpc.module.getModuleNames, settings]
  );
};

const useFilePathInvalidation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: settings } = useGlobalSettingsQuery();
  const invalidateFile = useFileInvalidation();
  return useCallback(
    (filePaths: string[]) => {
      const courses = new Set<string>();
      for (const filePath of filePaths) {
        const courseName = getCourseNameByPath(filePath, settings);
        if (!courseName) {
          console.log("no course settings found for file path, not invalidating cache", filePath);
          continue;
        }
        courses.add(courseName);
        invalidateFile(filePath, courseName);
      }
      // any change in a course folder can change what git has to commit: once per course per batch
      for (const courseName of courses) queryClient.invalidateQueries({ queryKey: trpc.git.status.queryKey(courseName) });
    },
    [queryClient, trpc.git.status, settings, invalidateFile]
  );
};

/** The queries one changed file makes stale, by what the file is. */
const useFileInvalidation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useCallback(
    (filePath: string, courseName: string) => {
      const splitPath = filePath.split("/");
      const [moduleOrLectures, itemType, itemFile] = splitPath.slice(-3);

      const itemName = itemFile ? removeFileExtension(itemFile) : undefined;
      const allParts = { courseName, moduleOrLectures, itemType, itemName };
      // console.log(
      //   "received file to invalidate",
      //   filePath,
      //   allParts,
      //   itemName,
      //   itemType
      // );

      if (moduleOrLectures === "settings.yml") {
        queryClient.invalidateQueries({
          queryKey: trpc.settings.allCoursesSettings.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.settings.courseSettings.queryKey(courseName),
        });
        return;
      }

      if (moduleOrLectures === "00 - lectures") {
        console.log("lecture updated on FS ", allParts);
        queryClient.invalidateQueries({
          queryKey: trpc.lectures.getLectures.queryKey(courseName),
        });
        return;
      }

      if (["assignments", "quizzes", "pages"].includes(itemType)) {
        // a file that starts or stops parsing moves in or out of these
        queryClient.invalidateQueries({
          queryKey: trpc.module.getInvalidItems.queryKey({
            courseName,
            moduleName: moduleOrLectures,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.module.getInvalidItemsForCourse.queryKey(courseName),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.module.getRawItem.queryKey(),
        });
      }

      // a bank's questions are part of every quiz that names it
      if (itemType === "banks") {
        queryClient.invalidateQueries({ queryKey: trpc.quiz.getBanks.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.quiz.listBankFiles.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.quiz.getQuiz.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.quiz.getAllQuizzes.queryKey() });
        return;
      }

      if (itemType === "assignments") {
        console.log("assignment updated on FS ", allParts);
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAllAssignments.queryKey({
            courseName,
            moduleName: moduleOrLectures,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.assignment.getAssignment.queryKey({
            courseName,
            moduleName: moduleOrLectures,
            assignmentName: itemName,
          }),
        });
        return;
      }

      if (itemType === "quizzes") {
        console.log("quiz updated on FS ", allParts);
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getAllQuizzes.queryKey({
            courseName,
            moduleName: moduleOrLectures,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.quiz.getQuiz.queryKey({
            courseName,
            moduleName: moduleOrLectures,
            quizName: itemName,
          }),
        });
        return;
      }

      if (itemType === "pages") {
        console.log("page updated on FS ", allParts);
        queryClient.invalidateQueries({
          queryKey: trpc.page.getAllPages.queryKey({
            courseName,
            moduleName: moduleOrLectures,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.getPage.queryKey({
            courseName,
            moduleName: moduleOrLectures,
            pageName: itemName,
          }),
        });
        return;
      }

      console.log("no cache invalidation match for file ", allParts);
    },
    [
      queryClient,
      trpc.assignment.getAllAssignments,
      trpc.assignment.getAssignment,
      trpc.lectures.getLectures,
      trpc.quiz.getBanks,
      trpc.quiz.listBankFiles,
      trpc.module.getInvalidItems,
      trpc.module.getInvalidItemsForCourse,
      trpc.module.getRawItem,
      trpc.page.getAllPages,
      trpc.page.getPage,
      trpc.quiz.getAllQuizzes,
      trpc.quiz.getQuiz,
      trpc.settings.allCoursesSettings,
      trpc.settings.courseSettings,
    ]
  );
};
