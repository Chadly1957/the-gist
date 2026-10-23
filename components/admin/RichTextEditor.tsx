"use client";

import { useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { workspaceFetch } from "@/lib/workspace-client";

// Full rich text editor for article bodies (TipTap/ProseMirror). Toolbar:
// headings, bold/italic, links, bullet + numbered lists, blockquote,
// divider, and inline images uploaded through the same R2 endpoint the
// product images use. Emits HTML on every change; the API sanitizes it
// again on save, so what is stored is always the safe subset.
export default function RichTextEditor({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
    ],
    content: initialHtml || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "article-body rich-editor px-4 py-3 min-h-[320px] focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  if (!editor) return <div className="border rounded-lg px-4 py-3 text-gray-400 text-sm">Loading editor…</div>;

  const btn = (active: boolean) =>
    `px-2.5 py-1.5 rounded-md text-sm border ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-100 border-gray-300"}`;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const onImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await workspaceFetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      const alt = window.prompt("Describe the image (alt text, optional)", "") || "";
      editor.chain().focus().setImage({ src: data.url as string, alt }).run();
    } catch {
      window.alert("Image upload failed. You can also paste an image URL into the header image field instead.");
    }
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b bg-gray-50">
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
        <button type="button" className={btn(editor.isActive("link"))} onClick={setLink}>Link</button>
        <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}>Divider</button>
        <button type="button" className={btn(false)} onClick={() => fileInput.current?.click()}>Insert image</button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onImagePick} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
