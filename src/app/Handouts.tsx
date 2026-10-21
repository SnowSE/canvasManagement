// The handouts in docs/, served by GitHub Pages. Same list as the README's
// Handouts section; a new handout goes in both.
const handouts = [
  {
    title: "Getting Started with CanvasManager",
    url: "https://snowse.github.io/canvasManagement/getting-started.html",
    covers:
      "setup, course settings, the calendar, editing assignments, quizzes, pages and lectures, publishing, Compare with Canvas, images, git, and the error list.",
  },
  {
    title: "Group Assignments & Student Schedules",
    url: "https://snowse.github.io/canvasManagement/group-assignments-and-student-schedules.html",
    covers:
      "group sets, per-student due dates, the date picker and settings autocomplete.",
  },
];

export default function Handouts() {
  return (
    <div className="border-4 border-slate-800 rounded px-4 py-3 m-3">
      <div className="pb-2">
        Illustrated guides for instructors using CanvasManager:
      </div>
      <ul className="list-disc ps-6 space-y-1 text-slate-300">
        {handouts.map((h) => (
          <li key={h.url}>
            <a
              href={h.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              {h.title}
            </a>
            : {h.covers}
          </li>
        ))}
      </ul>
    </div>
  );
}
