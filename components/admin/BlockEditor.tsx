"use client";

import { useState, useRef } from "react";

export interface Block {
  id: string;
  type: "header" | "text" | "image" | "articles" | "divider" | "button" | "footer";
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
  { type: "divider", label: "Divider", icon: "—" },
];

export default function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragRef = useRef<number | null>(null);

  function addBlock(type: Block["type"]) {
    const defaults: Record<Block["type"], Record<string, string>> = {
      header: { title: "The Gist Decatur", subtitle: "Your daily briefing", date: "{{DATE}}" },
      text: { html: "<p>Write your message here…</p>" },
      image: { url: "", alt: "", caption: "" },
      articles: { label: "Today's Top Stories" },
      divider: {},
      button: { label: "Read More", url: "https://" },
      footer: {
        text: "You're receiving this because you signed up at thegistdecatur.com",
        unsubscribeText: "Unsubscribe",
      },
    };
    const newBlock: Block = { id: generateId(), type, content: defaults[type] };
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
        </div>
      ) : (
        <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
          No image URL set
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
    default:
      return null;
  }
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
      return (
        <div className="space-y-3">
          {field("url", "Image URL", { placeholder: "https://example.com/image.jpg" })}
          {field("alt", "Alt text")}
          {field("caption", "Caption (optional)")}
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
    default:
      return null;
  }
}
