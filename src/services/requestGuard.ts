// The API sends requests to Canvas with the teacher's token and reads and
// writes the course files, so it only answers the app's own pages and
// programs on the same computer. A website can't make the browser send these headers any
// other way, so checking them refuses requests a web page tries to send:
// - Sec-Fetch-Site must say the request came from this app itself (browsers
//   count other ports on localhost as the same *site*, so "site" isn't
//   enough). The browser works it out from the addresses it sees, so a proxy
//   that rewrites Host doesn't change it. Browsers that don't send it are
//   checked by comparing Origin with Host instead.
// - Host must not be a public domain name: DNS rebinding points one at this
//   computer to get around the browser's same-origin rule. localhost, IP
//   addresses and local network names (one word, .local, .lan, .home.arpa,
//   .internal) are fine, so opening the manager from another machine on the
//   network keeps working; CANVAS_MANAGER_HOSTS allows a domain name too
// Programs that aren't browsers send neither header and are let through.

const hostnameOf = (host: string) => host.replace(/:\d+$/, "").toLowerCase();

export const isLocalName = (name: string) =>
  name === "localhost" ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(name) || // an IPv4 address
  /^\[[0-9a-f:.]+\]$/.test(name) || // an IPv6 address
  !name.includes(".") || // a machine name on the local network
  /\.(local|lan|home\.arpa|internal|localhost)$/.test(name);

export function isAllowedRequest(headers: Headers, extraHosts: string[] = []) {
  const host = headers.get("host") ?? "";
  const name = hostnameOf(host);
  if (!isLocalName(name) && !extraHosts.includes(name)) return false;

  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = headers.get("origin");
  // "null" is what a sandboxed frame sends, which a web page can make
  if (origin && (origin === "null" || new URL(origin).host !== host)) return false;
  return true;
}

const configuredHosts = () =>
  (process.env.CANVAS_MANAGER_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

/** A 403 for an API request that didn't come from this app, else undefined. */
export function refusal(request: Request) {
  if (!new URL(request.url).pathname.startsWith("/api/")) return undefined;
  if (isAllowedRequest(request.headers, configuredHosts())) return undefined;
  return new Response(
    "Refused: the manager only answers its own pages. To open it by a name other than localhost or an IP address, list that name in CANVAS_MANAGER_HOSTS.",
    { status: 403 }
  );
}
