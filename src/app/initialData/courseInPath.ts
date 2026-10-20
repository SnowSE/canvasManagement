/** The course a page's URL is in (/course/<name>/...), if any. */
export const courseInPath = (pathname: string) => {
  const match = /^\/course\/([^/]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : undefined;
};
