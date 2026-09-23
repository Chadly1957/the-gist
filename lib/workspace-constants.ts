export const DEFAULT_WORKSPACE_ID = "decatur";
export const DEFAULT_WORKSPACE_SLUG = "decatur";
export type WorkspaceInfo = { id: string; slug: string; name: string; area: string; domain: string | null };
export function pathWorkspace(pathname: string) {
  const match = pathname.match(/^\/w\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\/|$)/);
  return match ? { slug: match[1], prefix: match[0], pathname: pathname.slice(match[0].length) || "/" } : null;
}
