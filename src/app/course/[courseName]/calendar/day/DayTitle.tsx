import Modal, { useModal } from "@/components/Modal";
import { getLectureUrl } from "@/services/urlUtils";
import { Link } from "@tanstack/react-router";
import { useCourseContext } from "../../context/courseContext";
import NewItemForm from "../../modules/NewItemForm";
import { DraggableItem } from "../../context/drag/draggingContext";
import { useDragStyleContext } from "../../context/drag/dragStyleContext";
import { getLectureForDay } from "@/features/local/utils/lectureUtils";
import { useLecturesSuspenseQuery } from "@/features/local/lectures/lectureHooks";
import ClientOnly from "@/components/ClientOnly";
import { Tooltip } from "@/components/Tooltip";
import { useTooltip } from "@/components/useTooltip";

export function DayTitle({ day, dayAsDate }: { day: string; dayAsDate: Date }) {
  const { courseName } = useCourseContext();
  const { data: weeks } = useLecturesSuspenseQuery();
  const { setIsDragging } = useDragStyleContext();
  const todaysLecture = getLectureForDay(weeks, dayAsDate);
  const modal = useModal();
  const { visible, targetRef, showTooltip, hideTooltip } = useTooltip();
  const addTooltip = useTooltip<SVGSVGElement>(400);

  const lectureName = todaysLecture && (todaysLecture.name || "lecture");
  const dateLabel = (
    <>
      <span className="md:hidden">
        {dayAsDate.toLocaleString("default", { weekday: "short" })}{" "}
      </span>
      {dayAsDate.getDate()}
    </>
  );

  return (
    <div className="flex justify-between">
      <Link
        className={
          "group/title ms-1 me-1 min-w-0 flex-1 text-nowrap transition-all hover:font-bold hover:text-slate-300 " +
          (todaysLecture ? "truncate" : "flex")
        }
        to={getLectureUrl(courseName, day)}
        draggable={true}
        onDragStart={(e) => {
          if (todaysLecture) {
            const draggableItem: DraggableItem = {
              type: "lecture",
              item: { ...todaysLecture, dueAt: todaysLecture.date },
              sourceModuleName: undefined,
            };
            e.dataTransfer.setData(
              "draggableItem",
              JSON.stringify(draggableItem),
            );
            setIsDragging(true);
          }
        }}
        ref={targetRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {todaysLecture ? (
          <>
            {dateLabel} {lectureName}
          </>
        ) : (
          <>
            <span>{dateLabel}</span>
            {/* a quiet nudge that lecture notes exist; it truncates on its
                own so its ellipsis fades with it */}
            <span className="ms-1.5 min-w-0 self-center truncate text-sm font-normal text-slate-500 opacity-0 transition-opacity duration-500 group-hover/title:opacity-100">
              Add lecture notes
            </span>
          </>
        )}
      </Link>
      <ClientOnly>
        {(lectureName?.length ?? 0) > 0 && (
          <Tooltip
            message={
              <div>
                {lectureName}
                {todaysLecture?.content && (
                  <>
                    <pre>
                      <code>{todaysLecture?.content}</code>
                    </pre>
                  </>
                )}
              </div>
            }
            targetRef={targetRef}
            visible={visible}
          />
        )}
        <Tooltip
          message="Add assignment / quiz / page"
          targetRef={addTooltip.targetRef}
          visible={addTooltip.visible}
        />
      </ClientOnly>
      <Modal
        buttonComponent={({ openModal }) => (
          <svg
            viewBox="0 0 24 24"
            width={22}
            height={22}
            className="cursor-pointer hover:scale-125 hover:stroke-slate-400 stroke-slate-500 transition-all m-0.5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onClick={openModal}
            role="button"
            aria-label="Add assignment / quiz / page"
            ref={addTooltip.targetRef}
            onMouseEnter={addTooltip.showTooltip}
            onMouseLeave={addTooltip.hideTooltip}
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g
              id="SVGRepo_tracerCarrier"
              strokeLinecap="round"
              strokeLinejoin="round"
            ></g>
            <g id="SVGRepo_iconCarrier">
              <path
                d="M6 12H18M12 6V18"
                className=" "
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
            </g>
          </svg>
        )}
        modalControl={modal}
        modalWidth="w-135"
      >
        {({ closeModal }) => (
          <div>
            <NewItemForm creationDate={day} onCreate={closeModal} />
            <br />
            <button onClick={closeModal}>close</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
