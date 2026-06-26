"use client";

import { InputHTMLAttributes } from "react";
import { normalizeUrl } from "@/lib/url";

interface UrlInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

// URL input that auto-prepends https:// on blur when no scheme is present.
// Accepts bare domains (google.com), www prefixes, or full URLs.
export default function UrlInput({ value, onChange, onBlur, placeholder, ...props }: UrlInputProps) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder ?? "https://"}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const normalized = normalizeUrl(e.target.value);
        if (normalized !== e.target.value) onChange(normalized);
        (onBlur as React.FocusEventHandler<HTMLInputElement> | undefined)?.(e);
      }}
      {...props}
    />
  );
}
