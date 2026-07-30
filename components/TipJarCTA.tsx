import Link from "next/link";

interface Props {
  source: "wordy" | "match";
  variant?: "full" | "compact";
}

export default function TipJarCTA({ source, variant = "full" }: Props) {
  const href = `/tip?amount=3&source=${source}`;

  if (variant === "compact") {
    return (
      <div className="w-full flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <p className="text-[11px] text-amber-800 leading-snug">Enjoying this? Support The Gist ☕</p>
        <Link
          href={href}
          className="shrink-0 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
        >
          Tip $3
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs text-center bg-amber-50 border border-amber-100 rounded-xl px-5 py-4">
      <p className="text-sm font-semibold text-amber-900 mb-1">☕ Like what The Gist Decatur is doing?</p>
      <p className="text-xs text-amber-700 mb-3">Support the newsletter with a cup of coffee!</p>
      <Link
        href={href}
        className="inline-block bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
      >
        Tip $3
      </Link>
    </div>
  );
}
