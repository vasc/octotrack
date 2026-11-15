/** The script this page is running: its own bundle, `/assets/index-….js` once built. */
export const RUNNING_SCRIPT = import.meta.url;

/**
 * The served page's script when it is not the one this page is running: a deploy has happened since the page loaded.
 * Nothing when they match, when this page is not a built one (a dev server runs the sources), or when what was served
 * names no script, as an error page does.
 */
export function newBuild(running: string, servedPage: string): string | null {
  const runningPath = /\/assets\/index-[^/?#]+\.js/.exec(running)?.[0];
  if (runningPath === undefined) return null;
  const served = /<script[^>]*\ssrc="(\/assets\/index-[^"]+\.js)"/.exec(servedPage)?.[1];
  if (served === undefined || served === runningPath) return null;
  return served;
}
