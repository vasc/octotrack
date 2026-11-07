import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function snapshot(): string {
  return window.location.pathname + window.location.search;
}

export function navigate(to: string, replace = false): void {
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  notify();
}

export interface Route {
  path: string;
  params: URLSearchParams;
}

export function useRoute(): Route {
  const current = useSyncExternalStore(subscribe, snapshot);
  const url = new URL(current, "http://local");
  return { path: url.pathname, params: url.searchParams };
}

/** Changes query parameters and keeps the rest of the URL. Null removes a parameter. */
export function setParams(patch: Readonly<Record<string, string | null>>, replace = false): void {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  navigate(`${window.location.pathname}${query === "" ? "" : `?${query}`}`, replace);
}

export function openEntity(ref: string): void {
  setParams({ ref });
}

export function closeEntity(): void {
  setParams({ ref: null });
}
