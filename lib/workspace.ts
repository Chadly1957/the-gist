import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { basePrisma } from "./db-base";
import { DEFAULT_WORKSPACE_ID, type WorkspaceInfo } from "./workspace-constants";

const workspaceContext = new AsyncLocalStorage<WorkspaceInfo>();
export function withWorkspace<T>(workspace: WorkspaceInfo, task: () => T): T {
  return workspaceContext.run(workspace, task);
}
const requestWorkspaces = new WeakMap<ReturnType<typeof headers>, Promise<WorkspaceInfo>>();
async function resolveRequestWorkspace(h: ReturnType<typeof headers>): Promise<WorkspaceInfo> {
  const slug = h.get("x-gist-workspace");
  const host = (h.get("host") || "").split(":")[0].toLowerCase();
  const workspace = slug
    ? await basePrisma.workspace.findUnique({ where: { slug } })
    : await basePrisma.workspace.findUnique({ where: { domain: host } })
      ?? await basePrisma.workspace.findUnique({ where: { id: DEFAULT_WORKSPACE_ID } });
  if (!workspace) notFound();
  return workspace;
}
export async function getWorkspace(): Promise<WorkspaceInfo> {
  const jobWorkspace = workspaceContext.getStore();
  if (jobWorkspace) return jobWorkspace;
  const requestHeaders = headers();
  let workspace = requestWorkspaces.get(requestHeaders);
  if (!workspace) {
    workspace = resolveRequestWorkspace(requestHeaders);
    requestWorkspaces.set(requestHeaders, workspace);
  }
  return workspace;
}
export async function workspaceUnique<K extends string>(key: K, value: string) {
  const { id: workspaceId } = await getWorkspace();
  return { [`workspaceId_${key}`]: { workspaceId, [key]: value } } as {
    [P in `workspaceId_${K}`]: { workspaceId: string } & Record<K, string>
  };
}
export async function getWorkspaceUrl() {
  const ws = await getWorkspace();
  if (ws.domain) return `https://${ws.domain}`;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return ws.id === DEFAULT_WORKSPACE_ID ? base : `${base}/w/${ws.slug}`;
}
export async function workspaceEnv(key: string) {
  return (await getWorkspace()).id === DEFAULT_WORKSPACE_ID ? process.env[key] : undefined;
}
