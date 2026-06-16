import Image from "next/image";

export default function Logo({ className = "h-7 w-auto" }: { className?: string }) {
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
