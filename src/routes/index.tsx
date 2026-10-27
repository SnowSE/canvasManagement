import { pageTitle, titleHead } from "@/services/titleUtils";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Toggle } from "@/components/form/Toggle";
import CourseList from "@/app/CourseList";
import Handouts from "@/app/Handouts";
import { AddExistingCourseToGlobalSettings } from "@/app/addCourse/AddExistingCourseToGlobalSettings";
import AddCourseToGlobalSettings from "@/app/addCourse/AddNewCourse";
import TodaysLectures from "@/app/todaysLectures/TodaysLectures";
import UpdateAvailableBanner from "@/app/UpdateAvailableBanner";

export const Route = createFileRoute("/")({
  head: () => titleHead(pageTitle({})),
  component: Home,
});

function Home() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [openForm, setOpenForm] = useState<"new" | "existing" | null>(null);
  const toggleForm = (form: "new" | "existing") =>
    setOpenForm((current) => (current === form ? null : form));

  return (
    <main className="h-full flex justify-center overflow-auto">
      <div className="w-full xl:w-[900px] mx-auto px-3 pt-4 pb-96 flex flex-col gap-6">
        <UpdateAvailableBanner />
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Toggle
              label={"Delete Mode"}
              value={isDeleting}
              onChange={(set) => setIsDeleting(set)}
            />
            <div className="flex flex-wrap gap-3">
              <button onClick={() => toggleForm("new")}>
                {openForm === "new" ? "Hide Form" : "Add New Course"}
              </button>
              <button onClick={() => toggleForm("existing")}>
                {openForm === "existing"
                  ? "Hide Form"
                  : "Import Existing Course"}
              </button>
            </div>
          </div>
          <AddCourseToGlobalSettings showForm={openForm === "new"} />
          <AddExistingCourseToGlobalSettings
            showForm={openForm === "existing"}
          />
        </div>
        <div className=" flex justify-center">
          <CourseList isDeleting={isDeleting} />
        </div>
        <TodaysLectures />
        <Handouts />
      </div>
    </main>
  );
}
