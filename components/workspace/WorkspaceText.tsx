"use client";
import { useWorkspace } from "./WorkspaceProvider";
export default function WorkspaceText({ children }: { children: string }) {
  const { workspace } = useWorkspace();
  children = children.replaceAll("&apos;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
  if (workspace.id === "decatur") return <>{children}</>;
  return <>{children.replaceAll("The Gist Decatur", workspace.name).replaceAll("Gist Decatur", workspace.name).replaceAll("thegistdecatur.com", workspace.name).replaceAll("Decatur", workspace.area)}</>;
}
