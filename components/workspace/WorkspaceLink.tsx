"use client";
import Link from "next/link";
import { ComponentProps } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { workspacePath } from "@/lib/workspace-client";
export default function WorkspaceLink(props: ComponentProps<typeof Link>) {
  const { prefix } = useWorkspace();
  const href = typeof props.href === "string" ? workspacePath(props.href, prefix) : { ...props.href, pathname: workspacePath(props.href.pathname || "/", prefix) };
  return <Link {...props} href={href} />;
}
export function WorkspaceAnchor(props: ComponentProps<"a">) {
  const { prefix } = useWorkspace();
  return <a {...props} href={props.href ? workspacePath(props.href, prefix) : props.href} />;
}
