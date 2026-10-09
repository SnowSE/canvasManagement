"use client";
import { FC, ReactNode } from "react";

// Each type gets its own silhouette and color so they can be told apart at a
// glance on a crowded calendar: a pencil (assignment), a question mark in a
// circle (quiz) and a dog-eared document (page).
const Icon: FC<{ label: string; className: string; children: ReactNode }> = ({
  label,
  className,
  children,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={label}
    className={className}
  >
    {children}
  </svg>
);

export const ItemTypeIcon: FC<{ type: string }> = ({ type }) => {
  if (type === "assignment") {
    return (
      <Icon label="Assignment" className="text-sky-400/80">
        <path
          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
          fill="currentColor"
          fillOpacity=".2"
        />
        <path d="m15 5 3 3" />
        <path d="M13 20h8" />
      </Icon>
    );
  }
  if (type === "quiz") {
    return (
      <Icon label="Quiz" className="text-amber-400/80">
        <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity=".2" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" strokeWidth="2.5" />
      </Icon>
    );
  }
  if (type === "page") {
    return (
      <Icon label="Page" className="text-violet-300/80">
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
          fill="currentColor"
          fillOpacity=".2"
        />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </Icon>
    );
  }
  return <></>;
};
