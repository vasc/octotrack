/** The built files a page names: its scripts and stylesheets under /assets/, as paths. */
function assetsIn(html: string): string[] {
  return [...html.matchAll(/\s(?:src|href)="(\/assets\/[^"?#]+)"/g)].flatMap((match) => match[1] ?? []);
}

/**
 * What the served page loads that this page did not: a deploy since this page loaded, a new stylesheet alone
 * included. Only that direction counts, since this page also loads chunks of its own on demand. Nothing when the served
 * page names no built files, as an error page or a dev server's does.
 */
export function newBuild(loaded: readonly string[], servedPage: string): string[] {
  return assetsIn(servedPage).filter((asset) => !loaded.includes(asset));
}

/** The built files this page has loaded: the scripts and stylesheets in its document, as paths. */
export function loadedAssets(): string[] {
  return [...document.querySelectorAll("script[src], link[href]")].flatMap((element) => {
    const url = element.getAttribute("src") ?? element.getAttribute("href");
    if (url === null) return [];
    const path = new URL(url, document.baseURI).pathname;
    return path.startsWith("/assets/") ? [path] : [];
  });
}
