"use client";
import { createContext, useContext } from "react";
import type { WorkspaceInfo } from "@/lib/workspace-constants";
const Context = createContext<{ workspace: WorkspaceInfo; prefix: string } | null>(null);
export function WorkspaceProvider({ workspace, prefix, children }: { workspace: WorkspaceInfo; prefix: string; children: React.ReactNode }) {
  return <Context.Provider value={{ workspace, prefix }}><div key={workspace.id}>{children}</div></Context.Provider>;
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing workspace context");
  return context;
}
