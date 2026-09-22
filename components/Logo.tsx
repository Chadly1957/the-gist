"use client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Image from "next/image";

export default function Logo({ className = "h-7 w-auto" }: { className?: string }) {
  const { workspace } = useWorkspace();
  if (workspace.id !== "decatur") return <span className={`inline-flex items-center font-bold text-green-800 ${className}`}>{workspace.name}</span>;
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
