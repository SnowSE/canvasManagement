"use client";
import { Link } from "@tanstack/react-router";
import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { useActionsMenu } from "@/components/MobileActionsMenu";
import {
  AddIcon,
  CalendarIcon,
  CaretDownIcon,
  CheckMarkIcon,
  CompareIcon,
  ExternalLinkIcon,
  HelpIcon,
  HistoryIcon,
  NextIcon,
  PreviousIcon,
  PublishIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/icons/ActionIcons";
import {
  PublishableItemType,
  usePublishInCanvasMutation,
} from "@/features/canvas/hooks/canvasPublishHooks";
import { getCourseUrl, getModuleItemUrl } from "@/services/urlUtils";
import { useGitStatusQuery } from "@/features/local/git/gitHooks";
import { useCourseContext } from "./context/courseContext";
import { SyncField } from "./calendar/day/getAssignmentSyncStatus";

export interface FooterAction {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Opens in a new tab (Canvas). */
  href?: string;
  /** An in-app route. */
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  /** Opens a dialog; the mobile menu stays open so the dialog stays mounted. */
  opensDialog?: boolean;
}

/**
 * The assignment, quiz and page editors' footer. Instead of every Canvas
 * button at once, it says how the file stands against Canvas and offers the
 * one next step (add, update, publish or view); everything else is in the
 * ⋯ menu. In the mobile actions menu it lays the same actions out flat.
 */
export function EditorFooter({
  type,
  name,
  moduleName,
  canvasLoading,
  canvasItem,
  differences,
  canvasUrl,
  compareUrl,
  busy,
  onAdd,
  onUpdate,
  updateTitle,
  onViewInCanvas,
  extraActions = [],
  toggleHelp,
  previousUrl,
  nextUrl,
  children,
}: {
  type: PublishableItemType;
  name: string;
  moduleName: string;
  canvasLoading: boolean;
  canvasItem?: { id: number; published: boolean };
  /** Field-by-field differences, not counting Published. Undefined for types that are not compared (pages). */
  differences?: SyncField[];
  canvasUrl?: string;
  compareUrl?: string;
  busy: boolean;
  onAdd: () => void;
  onUpdate: () => void;
  updateTitle?: string;
  onViewInCanvas?: () => void;
  /** Classroom 50, the deletes: always in the ⋯ menu. */
  extraActions?: FooterAction[];
  toggleHelp?: () => void;
  previousUrl: string | null;
  nextUrl: string | null;
  /** Dialogs the actions open. */
  children?: ReactNode;
}) {
  const { courseName } = useCourseContext();
  const { inMenu } = useActionsMenu();
  const publish = usePublishInCanvasMutation();
  const { data: git } = useGitStatusQuery();

  const view: FooterAction | undefined = canvasUrl
    ? {
        label: "View in Canvas",
        icon: <ExternalLinkIcon />,
        href: canvasUrl,
        onClick: onViewInCanvas,
      }
    : undefined;
  const compare: FooterAction | undefined = compareUrl
    ? { label: "Compare with Canvas", icon: <CompareIcon />, to: compareUrl }
    : undefined;
  const update: FooterAction = {
    label: "Update in Canvas",
    icon: <UploadIcon />,
    onClick: onUpdate,
    title: updateTitle,
    disabled: busy,
  };
  const publishAction: FooterAction | undefined = canvasItem
    ? {
        label: publish.isPending ? "Publishing…" : "Publish in Canvas",
        icon: <PublishIcon />,
        title: "Publishes this item in Canvas so students can see it",
        disabled: publish.isPending,
        onClick: () =>
          publish.mutate({
            type,
            canvasItemId: canvasItem.id,
            name,
            moduleName,
          }),
      }
    : undefined;

  const statusClass = "inline-flex items-center gap-2 font-semibold";
  let status: ReactNode;
  let primary: FooterAction | undefined;
  let more: (FooterAction | undefined)[] = [];

  if (canvasLoading) {
    status = (
      <span className={statusClass + " text-slate-400"}>Checking Canvas…</span>
    );
  } else if (!canvasItem) {
    status = (
      <span className={statusClass + " text-slate-400"}>
        <span className="size-2 rounded-full bg-slate-500" />
        Not in Canvas yet
      </span>
    );
    primary = {
      label: "Add to Canvas",
      icon: <AddIcon />,
      onClick: onAdd,
      disabled: busy,
    };
  } else if (differences && differences.length > 0) {
    const text = `${differences.length} ${differences.length === 1 ? "difference" : "differences"} from Canvas`;
    const tooltip = differences.map((d) => d.label).join(", ");
    status = compareUrl ? (
      <Link
        to={compareUrl}
        title={tooltip}
        className={
          statusClass +
          " text-amber-300 hover:text-amber-200 underline underline-offset-4"
        }
      >
        <WarningIcon />
        {text}
      </Link>
    ) : (
      <span className={statusClass + " text-amber-300"} title={tooltip}>
        <WarningIcon />
        {text}
      </span>
    );
    primary = update;
    more = [view, compare, canvasItem.published ? undefined : publishAction];
  } else if (!canvasItem.published) {
    status = (
      <span className={statusClass}>
        {differences && (
          <span className="inline-flex items-center gap-1.5 text-green-400">
            <CheckMarkIcon />
            In sync
          </span>
        )}
        <span className="text-slate-400 font-normal">
          {differences ? "· " : "In Canvas · "}students can&rsquo;t see it yet
        </span>
      </span>
    );
    primary = publishAction;
    more = [view, compare, update];
  } else {
    status = (
      <span className={statusClass + " text-green-400"}>
        <CheckMarkIcon />
        {differences ? "In sync · Published" : "Published"}
      </span>
    );
    // pages aren't compared, so Update stays the next step for them
    primary = differences ? view : update;
    more = differences
      ? [compare, { ...update, label: "Update in Canvas anyway" }]
      : [view];
  }

  const history: FooterAction | undefined = git?.status.available
    ? {
        label: "File history",
        icon: <HistoryIcon />,
        to: getModuleItemUrl(courseName, moduleName, type, name) + "/history",
      }
    : undefined;

  const menuActions = [
    ...more.filter((a): a is FooterAction => !!a),
    ...(history ? [history] : []),
    ...extraActions,
  ];
  const calendar: FooterAction = {
    label: "Back to calendar",
    icon: <CalendarIcon />,
    to: getCourseUrl(courseName),
  };

  if (inMenu)
    return (
      <div className="flex flex-col">
        <div className="px-3 py-2">{status}</div>
        {busy && <Spinner />}
        {primary && <ActionControl action={primary} className="btn" />}
        {menuActions.map((a) => (
          <ActionControl
            key={a.label}
            action={a}
            className={a.danger ? "btn btn-danger" : "btn"}
          />
        ))}
        <div className="h-px bg-slate-700 my-1 mx-2" />
        {toggleHelp && (
          <ActionControl
            action={{
              label: "Toggle help",
              icon: <HelpIcon />,
              onClick: toggleHelp,
            }}
            className="btn"
          />
        )}
        {previousUrl && (
          <ActionControl
            action={{
              label: "Previous",
              icon: <PreviousIcon />,
              to: previousUrl,
            }}
            className="btn"
          />
        )}
        {nextUrl && (
          <ActionControl
            action={{ label: "Next", icon: <NextIcon />, to: nextUrl }}
            className="btn"
          />
        )}
        <ActionControl action={calendar} className="btn" />
        {children}
      </div>
    );

  const ghost =
    "unstyled btn inline-flex items-center gap-2 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100";
  const iconOnly = ghost + " px-2!";

  return (
    <div className="px-5 py-3 flex flex-row flex-wrap items-center justify-between gap-3">
      <div className="flex flex-row items-center gap-1">
        {toggleHelp && (
          <button
            className={iconOnly}
            onClick={toggleHelp}
            aria-label="Toggle help"
            title="Toggle help"
          >
            <HelpIcon />
          </button>
        )}
        {previousUrl && (
          <Link
            className={iconOnly}
            to={previousUrl}
            aria-label="Previous item"
            title="Previous item"
          >
            <PreviousIcon />
          </Link>
        )}
        {nextUrl && (
          <Link
            className={iconOnly}
            to={nextUrl}
            aria-label="Next item"
            title="Next item"
          >
            <NextIcon />
          </Link>
        )}
        <ActionControl action={calendar} className={ghost} />
      </div>
      <div className="flex flex-row flex-wrap items-center justify-end gap-3">
        {busy && <Spinner />}
        {status}
        {primary && <SplitButton primary={primary} actions={menuActions} />}
      </div>
      {children}
    </div>
  );
}

function ActionControl({
  action,
  className = "",
  onDone,
}: {
  action: FooterAction;
  className?: string;
  onDone?: () => void;
}) {
  const { closeMenu } = useActionsMenu();
  const content = (
    <span className="inline-flex items-center gap-2">
      {action.icon}
      {action.label}
    </span>
  );
  const handleClick = () => {
    action.onClick?.();
    onDone?.();
    if (!action.opensDialog) closeMenu();
  };

  if (action.href)
    return (
      <a
        className={className}
        href={action.href}
        target="_blank"
        rel="noreferrer"
        title={action.title}
        onClick={handleClick}
      >
        {content}
      </a>
    );
  if (action.to)
    return (
      <Link
        className={className}
        to={action.to}
        title={action.title}
        onClick={handleClick}
      >
        {content}
      </Link>
    );
  return (
    <button
      className={className}
      disabled={action.disabled}
      title={action.title}
      onClick={handleClick}
    >
      {content}
    </button>
  );
}

/**
 * The next step as a button, with the item's other actions in a dropdown
 * behind the caret on its right edge.
 */
function SplitButton({
  primary,
  actions,
}: {
  primary: FooterAction;
  actions: FooterAction[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const itemClass =
    "unstyled block w-full text-start px-3 py-2 rounded-md font-semibold disabled:opacity-50 ";

  return (
    <div ref={ref} className="relative flex flex-row">
      {/* .btn is unlayered CSS, so overriding its rounding and padding needs ! */}
      <ActionControl
        action={primary}
        className={
          "btn inline-flex items-center gap-2" +
          (actions.length > 0 ? " rounded-r-none!" : "")
        }
      />
      {actions.length > 0 && (
        <button
          className="btn rounded-l-none! px-2! border-l border-blue-950 inline-flex items-center"
          onClick={() => setOpen((o) => !o)}
          aria-label="More Canvas actions"
          aria-expanded={open}
          title="More Canvas actions"
        >
          <CaretDownIcon />
        </button>
      )}
      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-40 min-w-60 bg-slate-800 border border-slate-700 rounded-lg p-1.5 shadow-lg shadow-black/50 flex flex-col gap-0.5">
          {actions.map((a, i) => (
            <Fragment key={a.label}>
              {a.danger && i > 0 && !actions[i - 1].danger && (
                <div className="h-px bg-slate-700 my-1 mx-1.5" />
              )}
              <ActionControl
                action={a}
                onDone={() => setOpen(false)}
                className={
                  itemClass +
                  (a.danger
                    ? "text-red-300 hover:bg-red-950/60"
                    : "text-slate-200 hover:bg-slate-700")
                }
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
