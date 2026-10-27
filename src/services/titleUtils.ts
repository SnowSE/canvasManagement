import { getDateFromString } from "@/features/local/utils/timeUtils";

const appName = "Canvas Manager";

export function getTitle(title: string) {
  const prefix = process.env.NEXT_PUBLIC_TITLE_PREFIX
    ? process.env.NEXT_PUBLIC_TITLE_PREFIX + " "
    : "";
  return `${prefix}${title}`;
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Tabs are narrow, so the most specific part goes first: "Thing · Course — Canvas Manager".
export function pageTitle(parts: {
  thing?: string;
  courseName?: string;
  withAppName?: boolean;
}) {
  const { thing, courseName, withAppName = true } = parts;
  const specific = [thing, courseName && decode(courseName)]
    .filter(Boolean)
    .join(" · ");
  if (!specific) return getTitle(appName);
  return getTitle(withAppName ? `${specific} — ${appName}` : specific);
}

export const titleHead = (title: string) => ({ meta: [{ title }] });

export function itemTitle(prefix: string, itemName: string) {
  return `${prefix}${decode(itemName)}`;
}

// "10/27/2026" -> "Lecture Mon Oct 27"
export function lectureTitle(lectureDay: string) {
  const day = decode(lectureDay);
  const date = getDateFromString(day);
  if (!date) return `Lecture ${day}`;
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `Lecture ${formatted.replace(",", "")}`;
}
