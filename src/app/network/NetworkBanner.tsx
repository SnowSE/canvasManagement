"use client";
import { useState } from "react";
import { useNetworkExposureQuery } from "@/features/local/network/networkHooks";
import { isLocalName } from "@/services/requestGuard";

// A bar across the top of every page, never dismissed, while other machines
// may be able to reach the app's server, which sends requests to Canvas with
// the teacher's token and reads and writes the course files. It sits in the page's flow, so it pushes the page down rather than
// covering any of it.
//
// What it knows comes from the compose file (CANVAS_MANAGER_ADDRESS and
// CANVAS_MANAGER_PORT), which can say "local" while its ports line says
// otherwise, so the port the page was opened on is checked against it.
export function NetworkBanner() {
  const { data: exposure, error } = useNetworkExposureQuery();
  const [open, setOpen] = useState(false);
  // opened by a domain name the server doesn't know, it refuses the app's own
  // requests (see src/services/requestGuard.ts), so nothing would load
  const name = window.location.hostname;
  if (error && !isLocalName(name))
    return (
      <div className="flex-none mb-1 rounded border border-amber-700 bg-amber-950/60 text-amber-100 text-sm px-3 py-1 text-center">
        <span aria-hidden>⚠</span> CanvasManager only answers names it knows, and{" "}
        <code>{name}</code> isn&apos;t one of them. Add{" "}
        <code>CANVAS_MANAGER_HOSTS={name}</code> to <code>.env</code> and restart.
      </div>
    );
  if (!exposure) return null;

  const pagePort =
    window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  const outOfSync =
    exposure.kind === "local" && !!exposure.port && exposure.port !== pagePort;
  if (exposure.kind === "local" && !outOfSync) return null;

  const port = exposure.port || pagePort;
  const label =
    exposure.kind === "network"
      ? `Open to your network (${exposure.address}:${port})`
      : outOfSync
        ? "Can't confirm it's only on this computer"
        : "Possibly open to your network";

  return (
    <div className="flex-none mb-1 rounded border border-amber-700 bg-amber-950/60 text-amber-100 text-sm">
      <button
        className="unstyled w-full flex items-center justify-center gap-2 px-3 py-1 font-semibold hover:bg-amber-900/60"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span aria-hidden>⚠</span>
        {label}
        <span className="font-normal text-amber-300">
          {open ? "hide details" : "click for what this means and how to fix it"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 text-slate-200 max-w-4xl mx-auto">
          <p>
            CanvasManager&apos;s server sends requests to Canvas with your token
            and reads and writes your course files, so it should only be
            reachable from this computer.
          </p>
          {exposure.kind === "network" ? (
            <p>
              Its port is published on <code>{exposure.address}</code>, so other
              machines on your network can open it. If they should, keep it, on a
              network you trust. Otherwise remove{" "}
              <code>CANVAS_MANAGER_ADDRESS</code> from <code>.env</code> and
              restart.
            </p>
          ) : (
            <>
              {outOfSync ? (
                <p>
                  Your <code>docker-compose.yml</code> says it&apos;s published on
                  port {exposure.port}, but this page is open on port {pagePort},
                  so its <code>ports</code> line and its{" "}
                  <code>CANVAS_MANAGER_*</code> lines don&apos;t agree, and the
                  <code>ports</code> line may publish it on every network. (If you
                  open it through a separate proxy on another port, this is
                  expected.)
                </p>
              ) : (
                <p>
                  Your <code>docker-compose.yml</code> doesn&apos;t say where its
                  port is published, which means it&apos;s from before October 2026
                  and most likely listens on every network this computer is on.
                </p>
              )}
              <p>
                If <code>get-started.ps1</code> set it up, run it again and let it
                write a new <code>docker-compose.yml</code>. Otherwise, under the
                CanvasManager service in your <code>docker-compose.yml</code>:
              </p>
              <ol className="list-decimal ps-6 space-y-1">
                <li>
                  In the line under <code>ports:</code>, put{" "}
                  <code>{"${CANVAS_MANAGER_ADDRESS:-127.0.0.1}:"}</code> in front
                  of what&apos;s there, and keep the rest exactly as it is, port
                  and all (it may be shared with another setup that starts it
                  on a different port).
                </li>
                <li>
                  Under its <code>environment:</code> (add{" "}
                  <code>environment:</code> if the service has none), add{" "}
                  <code>{"CANVAS_MANAGER_ADDRESS=${CANVAS_MANAGER_ADDRESS:-127.0.0.1}"}</code>{" "}
                  and <code>CANVAS_MANAGER_PORT=</code> followed by the first
                  number of your <code>ports</code> line, written the same way.
                </li>
                <li>Restart it.</li>
              </ol>
              <p>For example, if its port line is <code>{`- "${port}:3000"`}</code>:</p>
              <pre className="text-xs bg-slate-950 p-2 rounded overflow-x-auto">{`    ports:
      - "\${CANVAS_MANAGER_ADDRESS:-127.0.0.1}:${port}:3000"
    environment:
      - CANVAS_MANAGER_ADDRESS=\${CANVAS_MANAGER_ADDRESS:-127.0.0.1}
      - CANVAS_MANAGER_PORT=${port}`}</pre>
              <p>
                If the port is a variable, like{" "}
                <code>{`"\${CANVAS_MANAGER_PORT:-${port}}:3000"`}</code>, keep it and
                write the same variable after <code>CANVAS_MANAGER_PORT=</code>,
                so the two always agree.
              </p>
            </>
          )}
          <a
            href="https://snowse.github.io/canvasManagement/getting-started.html#setup-local-only"
            target="_blank"
            rel="noreferrer"
          >
            More in the getting-started guide
          </a>
        </div>
      )}
    </div>
  );
}
