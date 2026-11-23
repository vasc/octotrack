import { existsSync } from "node:fs";
import { join, normalize } from "node:path";

/** Files at the root of the built dashboard that make it an installable app. */
const ROOT_FILES: ReadonlySet<string> = new Set([
  "/sw.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
]);

/** Finds a dashboard file by its path under dist, such as "/assets/index-abc.js" or "/index.html". */
export type Locate = (relative: string) => string | null;

/** From the built dashboard next to the code: a checkout, after `bun run build`. */
export function fromDist(dist: string): Locate {
  return (relative) => {
    const candidate = join(dist, relative);
    return candidate.startsWith(dist) && existsSync(candidate) ? candidate : null;
  };
}

/** From files a compiled binary carries inside itself, keyed by their path under dist. */
export function fromEmbedded(files: ReadonlyMap<string, string>): Locate {
  return (relative) => files.get(relative) ?? null;
}

/**
 * Serves the dashboard: hashed assets cached forever, and the page itself for every other path, so that the app's own
 * routes load. Nothing at all when there is no built dashboard.
 */
export function dashboardAssets(locate: Locate): (path: string) => Promise<Response | null> {
  return async (path) => {
    const page = locate("/index.html");
    if (page === null) return null;
    const relative = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const asset = relative.startsWith("/assets/") ? locate(relative) : null;
    if (asset !== null) {
      // File names are content hashes, so these can be cached forever.
      return new Response(Bun.file(asset), {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      });
    }
    // The installable app's own files live at the root, under fixed names, so they are always checked again.
    const own = ROOT_FILES.has(relative) ? locate(relative) : null;
    if (own !== null) {
      const headers: Record<string, string> = { "cache-control": "no-cache" };
      if (relative === "/manifest.webmanifest") headers["content-type"] = "application/manifest+json";
      return new Response(Bun.file(own), { headers });
    }
    return new Response(Bun.file(page), { headers: { "cache-control": "no-cache" } });
  };
}

let embedded: ReadonlyMap<string, string> | null = null;

/** A compiled binary's entry hands over the dashboard it carries before anything serves. */
export function embedDashboard(files: ReadonlyMap<string, string>): void {
  embedded = files;
}

/** The dashboard this process serves: the embedded one in a binary, the built one in a checkout. */
export function currentDashboard(dist: string): Locate {
  return embedded === null ? fromDist(dist) : fromEmbedded(embedded);
}
