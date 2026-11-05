import { FC, ReactNode } from "react";

// Small stroke icons for the editor footer's buttons and menu. They take the
// text color, so one icon works on a blue button, in a red menu item or in
// green status text.
const ActionIcon: FC<{ children: ReactNode; strokeWidth?: number }> = ({
  children,
  strokeWidth = 2,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-[1.15em] shrink-0"
  >
    {children}
  </svg>
);

export const ModulesIcon = () => (
  <ActionIcon>
    <rect x="3" y="4" width="18" height="6" rx="1" />
    <rect x="3" y="14" width="18" height="6" rx="1" />
  </ActionIcon>
);

export const HelpIcon = () => (
  <ActionIcon>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </ActionIcon>
);

export const EditIcon = () => (
  <ActionIcon>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </ActionIcon>
);

export const PreviewIcon = () => (
  <ActionIcon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </ActionIcon>
);

export const SettingsIcon = () => (
  <ActionIcon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </ActionIcon>
);

export const ImportIcon = () => (
  <ActionIcon>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 17v3h16v-3" />
  </ActionIcon>
);

/** A pane in its own window: an arrow out of a box. */
export const PopOutIcon = () => (
  <ActionIcon>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </ActionIcon>
);

/** Pinned: pushed in, the head down where the needle was; unpinned: the head up and the needle showing. */
export const PinIcon = ({ pinned = false }: { pinned?: boolean }) => (
  <ActionIcon>
    <g transform={pinned ? "translate(0 6)" : undefined}>
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z" fill={pinned ? "currentColor" : "none"} />
    </g>
    {!pinned && <path d="M12 14v6" />}
  </ActionIcon>
);

export const PanesIcon = () => (
  <ActionIcon>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M9 4v16" />
    <path d="M15 4v16" />
  </ActionIcon>
);

export const PreviousIcon = () => (
  <ActionIcon strokeWidth={2.2}>
    <path d="m15 6-6 6 6 6" />
  </ActionIcon>
);

export const NextIcon = () => (
  <ActionIcon strokeWidth={2.2}>
    <path d="m9 6 6 6-6 6" />
  </ActionIcon>
);

export const CalendarIcon = () => (
  <ActionIcon>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </ActionIcon>
);

export const ClassroomIcon = () => (
  <ActionIcon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M18 14c2 .6 3 2.8 3 6" />
  </ActionIcon>
);

export const ExternalLinkIcon = () => (
  <ActionIcon>
    <path d="M14 4h6v6" />
    <path d="M20 4 10 14" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </ActionIcon>
);

export const CompareIcon = () => (
  <ActionIcon>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h13" />
    <path d="m17 12 4 4-4 4" />
    <path d="M21 16H8" />
  </ActionIcon>
);

export const HistoryIcon = () => (
  <ActionIcon>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </ActionIcon>
);

export const UploadIcon = () => (
  <ActionIcon>
    <path d="M12 16V4" />
    <path d="m6 10 6-6 6 6" />
    <path d="M4 20h16" />
  </ActionIcon>
);

export const AddIcon = () => (
  <ActionIcon>
    <path d="M12 5v14M5 12h14" />
  </ActionIcon>
);

export const PublishIcon = () => (
  <ActionIcon>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </ActionIcon>
);

export const CheckMarkIcon = () => (
  <ActionIcon strokeWidth={2.6}>
    <path d="m5 12 5 5 9-10" />
  </ActionIcon>
);

export const WarningIcon = () => (
  <ActionIcon>
    <path d="M12 3 2 21h20z" />
    <path d="M12 10v5M12 18h.01" />
  </ActionIcon>
);

export const TrashIcon = () => (
  <ActionIcon>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M9 7V4h6v3" />
  </ActionIcon>
);

export const CaretDownIcon = () => (
  <ActionIcon strokeWidth={2.4}>
    <path d="m6 9 6 6 6-6" />
  </ActionIcon>
);
