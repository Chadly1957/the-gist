"use client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Image from "next/image";

export default function Logo({ className = "h-7 w-auto" }: { className?: string }) {
  const { workspace } = useWorkspace();
  // Uploaded branding wins. Falls back to the bundled per-city assets, then
  // the workspace name as text for cities without branding yet.
  if (workspace.logoUrl)
    return (
      <Image
        src={workspace.logoUrl}
        alt={`${workspace.name} logo`}
        width={160}
        height={64}
        className={`object-contain ${className}`}
        priority
      />
    );
  // Key bundled branding off the slug (human-chosen, e.g. "effingham"),
  // falling back to the id. New workspaces get generated cuid ids, so id
  // alone misses.
  const brand = workspace.slug || workspace.id;
  if (brand === "effingham")
    return (
      <Image
        src="/effingham-logo.png"
        alt="The Gist Effingham"
        width={160}
        height={134}
        className={`object-contain ${className}`}
        priority
      />
    );
  if (brand !== "decatur") return <span className={`inline-flex items-center font-bold text-green-800 ${className}`}>{workspace.name}</span>;
  return (
    <Image
      src="/the-gist-logo.png"
      alt="The Gist Decatur"
      width={160}
      height={40}
      className={`object-contain ${className}`}
      priority
    />
  );
}
