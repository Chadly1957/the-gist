"use client";

// Small, unmissable workspace badge used across the admin so it is always
// obvious which workspace a row belongs to.
export default function WsBadge({
  name,
  color,
  size = "sm",
}: {
  name: string;
  color?: string | null;
  size?: "sm" | "md";
}) {
  const bg = color || "#4b5563";
  const textSize = size === "md" ? "text-sm" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${textSize} font-semibold px-2.5 py-0.5 rounded-full text-white whitespace-nowrap`}
      style={{ backgroundColor: bg }}
      title={`Workspace: ${name}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
      {name}
    </span>
  );
}
