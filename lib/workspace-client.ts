import { pathWorkspace } from "./workspace-constants";

export function workspacePath(path: string, prefix?: string) {
  const base = prefix ?? (typeof window !== "undefined" ? pathWorkspace(window.location.pathname)?.prefix || "" : "");
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/w/") || path.startsWith("/_next/")) return path;
  return `${base}${path}`;
}
export function workspaceFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(typeof input === "string" ? workspacePath(input) : input, init);
}
function storageKey(key: string) {
  const slug = pathWorkspace(window.location.pathname)?.slug;
  return !slug || slug === "decatur" ? key : `workspace:${slug}:${key}`;
}
export const workspaceStorage = {
  getItem: (key: string) => localStorage.getItem(storageKey(key)),
  setItem: (key: string, value: string) => localStorage.setItem(storageKey(key), value),
  removeItem: (key: string) => localStorage.removeItem(storageKey(key)),
};
