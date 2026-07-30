"use client";

import { useState, useRef } from "react";
import UrlInput from "@/components/UrlInput";

export interface Block {
  id: string;
  type: "header" | "text" | "image" | "articles" | "divider" | "button" | "footer" | "spotlight" | "presenting_sponsor" | "events" | "referral" | "poll" | "wordy" | "match" | "games";
  content: Record<string, string>;
}

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

const BLOCK_TYPES: { type: Block["type"]; label: string; icon: string }[] = [
  { type: "text", label: "Text Block", icon: "T" },
  { type: "image", label: "Image", icon: "IMG" },
  { type: "button", label: "Button / CTA", icon: "BTN" },
  { type: "divider", label: "Divider", icon: "─" },
  { type: "events", label: "Upcoming Events", icon: "📅" },
  { type: "spotlight", label: "Community Partners", icon: "★" },
  { type: "presenting_sponsor", label: "Presenting Sponsor", icon: "✦" },
  { type: "referral", label: "Refer a Friend", icon: "🔗" },
  { type: "poll", label: "Poll", icon: "📊" },
  { type: "wordy", label: "Decatur Wordy", icon: "🟩" },
  { type: "match", label: "Gist Match", icon: "🧩" },
  { type: "games", label: "Games (Wordy + Match)", icon: "🎮" },
];

export default function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragRef = useRef<number | null>(null);

  function addBlock(type: Block["type"]) {
    const defaults: Record<Block["type"], Record<string, string>> = {
      header: { title: "The Gist Decatur", subtitle: "Your daily briefing", date: "{{DATE}}" },
      text: { html: "<p>Write your message here…</p>" },
      image: { url: "", alt: "", caption: "", paddingTop: "0", paddingRight: "0", paddingBottom: "0", paddingLeft: "0" },
      articles: { label: "Today's Top Stories" },
      divider: {},
      button: { label: "Read More", url: "https://" },
      footer: {
        text: "You're receiving this because you signed up at thegistdecatur.com",
        unsubscribeText: "Unsubscribe",
      },
      spotlight: {},
      presenting_sponsor: {},
      events: {},
      referral: {
        title: "Refer a Friend, Earn Rewards",
        text: "Know someone who'd love The Gist Decatur? Share your unique link and earn a chance to win a prize!",
        buttonLabel: "Share Your Referral Link →",
      },
      poll: {
        question: "What do you think?",
        option0: "Yes",
        option1: "No",
        option2: "",
        option3: "",
      },
      wordy: { buttonLabel: "Play Today's Wordy →" },
      match: { buttonLabel: "Play Today's Match →" },
      games: { wordyButtonLabel: "Play Decatur Wordy →", matchButtonLabel: "Play Gist Match →" },
    };
    const newBlock: Block = { id: generateId(), type, content: { ...defaults[type], blockId: "" } };
    if (type === "poll") newBlock.content.blockId = newBlock.id;
    onChange([...blocks, newBlock]);
    setEditingId(newBlock.id);
  }

  function updateBlock(id: string, content: Record<string, string>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= blocks.length) return;
    const arr = [...blocks];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    onChange(arr);
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="group relative border border-gray-200 rounded-xl bg-white"
        >
          {/* Block controls */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {block.type === "articles" ? "Article List Block" : block.type}
              </span>
              {block.type === "articles" && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Auto-filled by scraper
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveBlock(index, -1)}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => moveBlock(index, 1)}
                disabled={index === blocks.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={() =>
                  setEditingId(editingId === block.id ? null : block.id)
                }
                className="p-1 text-gray-400 hover:text-blue-600"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => removeBlock(block.id)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Remove"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Block preview */}
          <div className="px-4 py-3">
            <BlockPreview block={block} />
          </div>

          {/* Inline editor */}
          {editingId === block.id && (
            <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 rounded-b-xl">
              <BlockFields
                block={block}
                onChange={(content) => updateBlock(block.id, content)}
              />
            </div>
          )}
        </div>
      ))}

      {/* Add block buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            onClick={() => addBlock(bt.type)}
            className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-700 rounded-lg text-xs font-medium transition-colors"
          >
            <span className="font-mono">{bt.icon}</span>
            {bt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: Block }) {
  switch (block.type) {
    case "header":
      return (
        <div className="text-center py-3 px-4 bg-green-800 rounded-lg">
          <p className="text-white font-bold text-lg">{block.content.title}</p>
          {block.content.subtitle && (
            <p className="text-green-300 text-xs mt-0.5">{block.content.subtitle}</p>
          )}
        </div>
      );
    case "text":
      return (
        <div
          className="text-sm text-gray-600 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: block.content.html || "" }}
        />
      );
    case "image":
      return block.content.url ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.content.url} alt={block.content.alt} className="max-h-32 rounded object-cover" />
          {block.content.caption && (
            <p className="text-xs text-gray-400 mt-1">{block.content.caption}</p>
          )}
          {(block.content.paddingTop || block.content.paddingRight || block.content.paddingBottom || block.content.paddingLeft) && (
            <p className="text-xs text-gray-400 mt-1">
              Padding: {block.content.paddingTop || 0}px {block.content.paddingRight || 0}px {block.content.paddingBottom || 0}px {block.content.paddingLeft || 0}px
            </p>
          )}
        </div>
      ) : (
        <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
          No image set
        </div>
      );
    case "articles":
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{block.content.label || "Article List"}</p>
            <p className="text-xs text-gray-400">Populated automatically with scraped articles when composing</p>
          </div>
        </div>
      );
    case "spotlight":
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
            <span className="text-yellow-600 text-sm">★</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Community Partners</p>
            <p className="text-xs text-gray-400">Auto-filled with 5 rotating approved listings</p>
          </div>
        </div>
      );
    case "presenting_sponsor":
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <span className="text-purple-600 text-sm">✦</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Presenting Sponsor</p>
            <p className="text-xs text-gray-400">Auto-filled with approved presenting sponsor for the newsletter date</p>
          </div>
        </div>
      );
    case "events":
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Upcoming Events</p>
            <p className="text-xs text-gray-400">Auto-filled with approved events in the next 30 days when the newsletter is sent</p>
          </div>
        </div>
      );
    case "divider":
      return <hr className="border-gray-200" />;
    case "button":
      return (
        <div className="flex">
          <span className="inline-block bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg">
            {block.content.label || "Button"}
          </span>
        </div>
      );
    case "footer":
      return (
        <div className="text-center py-2">
          <p className="text-xs text-gray-400">{block.content.text}</p>
          <p className="text-xs text-blue-400 underline mt-0.5">{block.content.unsubscribeText}</p>
        </div>
      );
    case "referral":
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Refer a Friend</div>
          <p className="text-sm font-bold text-gray-900 mb-1">{block.content.title || "Refer a Friend, Earn Rewards"}</p>
          <p className="text-xs text-gray-500 mb-2">{block.content.text || "Share your unique link…"}</p>
          <span className="inline-block bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            {block.content.buttonLabel || "Share Your Referral Link →"}
          </span>
        </div>
      );
    case "poll": {
      const opts = [block.content.option0, block.content.option1, block.content.option2, block.content.option3].filter(Boolean);
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Quick Poll</div>
          <p className="text-sm font-bold text-gray-900 mb-2">{block.content.question || "What do you think?"}</p>
          <div className="space-y-1">
            {opts.map((opt, i) => (
              <div key={i} className="border-2 border-green-600 rounded-md px-3 py-1.5 text-sm font-medium text-green-800 text-center">{opt}</div>
            ))}
          </div>
        </div>
      );
    }
    case "wordy":
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Decatur Wordy</div>
          <div className="text-lg mb-1">🟩🟨⬛🟩🟨</div>
          <p className="text-sm font-bold text-gray-900 mb-1">Today&apos;s word — can you guess it?</p>
          <p className="text-xs text-gray-500 mb-2">All answers are Decatur area related</p>
          <span className="inline-block bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            {block.content.buttonLabel || "Play Today's Wordy →"}
          </span>
        </div>
      );
    case "match":
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Gist Match</div>
          <div className="text-lg mb-1">🟨🟩🟦🟪🟥</div>
          <p className="text-sm font-bold text-gray-900 mb-1">Today&apos;s daily match-3 puzzle</p>
          <p className="text-xs text-gray-500 mb-2">Score points and climb today&apos;s shared leaderboard</p>
          <span className="inline-block bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            {block.content.buttonLabel || "Play Today's Match →"}
          </span>
        </div>
      );
    case "games":
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 text-center">Today&apos;s Games</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-base mb-1">🟩🟨⬛</div>
              <p className="text-xs font-bold text-gray-900 mb-1.5">Decatur Wordy</p>
              <span className="inline-block bg-green-700 text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
                {block.content.wordyButtonLabel || "Play →"}
              </span>
            </div>
            <div className="text-center border-l border-green-200">
              <div className="text-base mb-1">🟨🟩🟦</div>
              <p className="text-xs font-bold text-gray-900 mb-1.5">Gist Match</p>
              <span className="inline-block bg-green-700 text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
                {block.content.matchButtonLabel || "Play →"}
              </span>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function ImageBlockFields({
  block,
  onChange,
}: {
  block: Block;
  onChange: (content: Record<string, string>) => void;
}) {
  const c = block.content;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
      } else {
        onChange({ ...c, url: data.url });
      }
    } catch {
      setUploadError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* Image source */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Image</label>
        <div className="flex gap-2">
          <UrlInput
            value={c.url || ""}
            onChange={(val) => onChange({ ...c, url: val })}
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            id={`upload-${block.id}`}
            onChange={handleFileChange}
          />
          <label
            htmlFor={`upload-${block.id}`}
            className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? "Uploading…" : "Upload"}
          </label>
        </div>
        {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
        <p className="text-xs text-gray-400 mt-1">Paste a URL or upload an image (max 5MB). Uploaded images are stored in Supabase Storage.</p>
      </div>

      {/* Alt text */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Alt text</label>
        <input
          type="text"
          value={c.alt || ""}
          onChange={(e) => onChange({ ...c, alt: e.target.value })}
          placeholder="Brief description for screen readers"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Caption */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Caption (optional)</label>
        <input
          type="text"
          value={c.caption || ""}
          onChange={(e) => onChange({ ...c, caption: e.target.value })}
          placeholder="Image caption"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Padding */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Padding (px): <span className="font-normal text-gray-400">set all to 0 for full-width banners</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(["Top", "Right", "Bottom", "Left"] as const).map((side) => {
            const key = `padding${side}` as keyof typeof c;
            return (
              <div key={side}>
                <label className="block text-xs text-gray-400 mb-1 text-center">{side}</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={c[key] ?? "0"}
                  onChange={(e) => onChange({ ...c, [key]: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  block: Block;
  onChange: (content: Record<string, string>) => void;
}) {
  const c = block.content;

  function field(
    key: string,
    label: string,
    opts?: {
      type?: string;
      placeholder?: string;
      rows?: number;
      hint?: string;
    }
  ) {
    const { type = "text", placeholder = "", rows, hint } = opts || {};
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
        {rows ? (
          <textarea
            value={c[key] || ""}
            onChange={(e) => onChange({ ...c, [key]: e.target.value })}
            rows={rows}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
          />
        ) : type === "url" ? (
          <UrlInput
            value={c[key] || ""}
            onChange={(val) => onChange({ ...c, [key]: val })}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        ) : (
          <input
            type={type}
            value={c[key] || ""}
            onChange={(e) => onChange({ ...c, [key]: e.target.value })}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    );
  }

  switch (block.type) {
    case "header":
      return (
        <div className="space-y-3">
          {field("title", "Newsletter Title")}
          {field("subtitle", "Subtitle")}
          {field("date", "Date", { hint: 'Use {{DATE}} to auto-insert today\'s date' })}
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          {field("html", "Content (HTML)", {
            rows: 6,
            placeholder: "<p>Your text here. You can use HTML tags like <strong>, <em>, <a href='...'>, etc.</p>",
            hint: "Supports HTML: <p>, <strong>, <em>, <a href='...'>, <ul>, <li>, <br>",
          })}
        </div>
      );
    case "image":
      return <ImageBlockFields block={block} onChange={onChange} />;
    case "spotlight":
      return <p className="text-xs text-gray-400">No configuration needed. This block auto-populates with the most-eligible approved community partner listings at send time.</p>;
    case "presenting_sponsor":
      return <p className="text-xs text-gray-400">No configuration needed. This block auto-populates with the approved presenting sponsor for the selected newsletter date. Hidden if no sponsor is booked.</p>;
    case "referral":
      return (
        <div className="space-y-3">
          {field("title", "Heading", { placeholder: "Refer a Friend, Earn Rewards" })}
          {field("text", "Body Text", { rows: 2, placeholder: "Know someone who'd love The Gist Decatur? Share your unique link and earn a chance to win a prize!" })}
          {field("buttonLabel", "Button Label", { placeholder: "Share Your Referral Link →" })}
          <p className="text-xs text-gray-400">Each subscriber automatically gets a unique referral link. The button links to their personal referral portal at thegistdecatur.com/refer/[code].</p>
        </div>
      );
    case "articles":
      return (
        <div className="space-y-3">
          {field("label", "Section Label", { placeholder: "Today's Top Stories" })}
          <p className="text-xs text-gray-400">
            Articles are populated automatically from the scraper when you compose an issue.
            Selected articles will appear in this block.
          </p>
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          {field("label", "Button Label", { placeholder: "Read More" })}
          {field("url", "Link URL", { type: "url", placeholder: "https://" })}
        </div>
      );
    case "footer":
      return (
        <div className="space-y-3">
          {field("text", "Footer Text", { rows: 2 })}
          {field("unsubscribeText", "Unsubscribe Link Text")}
        </div>
      );
    case "poll":
      return (
        <div className="space-y-3">
          {field("question", "Poll Question", { placeholder: "What do you think?" })}
          {field("option0", "Option 1", { placeholder: "Yes" })}
          {field("option1", "Option 2", { placeholder: "No" })}
          {field("option2", "Option 3 (optional)", { placeholder: "" })}
          {field("option3", "Option 4 (optional)", { placeholder: "" })}
          <p className="text-xs text-gray-400">Subscribers click their choice in the email. Results appear in the Polls tab after sending.</p>
        </div>
      );
    case "wordy":
      return (
        <div className="space-y-3">
          {field("buttonLabel", "Button Label", { placeholder: "Play Today's Wordy →" })}
          <p className="text-xs text-gray-400">Links to thegistdecatur.com/wordy. Word length and puzzle number are pulled from the Wordy schedule at send time.</p>
        </div>
      );
    case "match":
      return (
        <div className="space-y-3">
          {field("buttonLabel", "Button Label", { placeholder: "Play Today's Match →" })}
          <p className="text-xs text-gray-400">Links to thegistdecatur.com/match. A new shared puzzle and leaderboard unlock every day at midnight.</p>
        </div>
      );
    case "games":
      return (
        <div className="space-y-3">
          {field("wordyButtonLabel", "Wordy Button Label", { placeholder: "Play Decatur Wordy →" })}
          {field("matchButtonLabel", "Match Button Label", { placeholder: "Play Gist Match →" })}
          <p className="text-xs text-gray-400">Combines Decatur Wordy and Gist Match side by side in one block — use this instead of adding both games separately.</p>
        </div>
      );
    default:
      return null;
  }
}
