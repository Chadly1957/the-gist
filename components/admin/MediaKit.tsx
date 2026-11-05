"use client";

import { useEffect, useRef, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { defaultKitEmailBody } from "@/lib/sponsor-slug";
import {
  clampZone,
  DEFAULT_LOGO_ZONE,
  DEFAULT_QR_ZONE,
  type MediaKitKind,
  type MediaKitZone,
} from "@/lib/media-kit-shared";

// Media Kit Builder admin UI (Admin > Sponsors > Profiles):
// - MediaKitTemplatesCard: per-workspace flyer + social templates.
//   Upload a finished background design, then drag the QR box and the
//   logo box onto the blank spots in the design. Zones save as relative
//   coordinates, so they survive the template being any resolution.
// - MediaKitModal: per-sponsor preview + one-go send. The server
//   composes the kit (QR for their join page + their logo, or their
//   business name when they have no usable logo) and emails it.

interface TemplateData {
  kind: MediaKitKind;
  imageUrl: string;
  qrZone: MediaKitZone;
  logoZone: MediaKitZone;
  updatedAt: string;
}

interface ProfileLite {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  joinUrl: string;
}

/* ---------------- Zone editor ---------------- */

function ZoneEditor({
  imageUrl,
  qrZone,
  logoZone,
  onQrChange,
  onLogoChange,
}: {
  imageUrl: string;
  qrZone: MediaKitZone;
  logoZone: MediaKitZone;
  onQrChange: (z: MediaKitZone) => void;
  onLogoChange: (z: MediaKitZone) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const naturalRef = useRef<{ w: number; h: number } | null>(null);
  const [, forceRender] = useState(0);
  const dragRef = useRef<{
    which: "qr" | "logo";
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startZone: MediaKitZone;
  } | null>(null);
  const latestRef = useRef({ qrZone, logoZone, onQrChange, onLogoChange });
  latestRef.current = { qrZone, logoZone, onQrChange, onLogoChange };

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      const el = containerRef.current;
      if (!drag || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      let z: MediaKitZone = { ...drag.startZone };
      if (drag.mode === "move") {
        z.x += dx;
        z.y += dy;
      } else {
        z.w += dx;
        z.h += dy;
      }
      if (drag.which === "qr" && naturalRef.current) {
        // Keep the QR zone square in pixels: h as a fraction of height
        // must equal w as a fraction of width, scaled by the aspect.
        const aspect = naturalRef.current.w / naturalRef.current.h;
        if (drag.mode === "resize") {
          z.h = z.w * aspect;
          if (z.y + z.h > 1) {
            z.h = 1 - z.y;
            z.w = z.h / aspect;
          }
          if (z.x + z.w > 1) {
            z.w = 1 - z.x;
            z.h = z.w * aspect;
          }
        } else {
          z.h = z.w * aspect;
        }
      }
      z = clampZone(z);
      const latest = latestRef.current;
      if (drag.which === "qr") latest.onQrChange(z);
      else latest.onLogoChange(z);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function startDrag(
    e: React.PointerEvent,
    which: "qr" | "logo",
    mode: "move" | "resize",
    zone: MediaKitZone
  ) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { which, mode, startX: e.clientX, startY: e.clientY, startZone: zone };
  }

  function renderBox(
    which: "qr" | "logo",
    zone: MediaKitZone,
    label: string,
    colors: string,
    handleColors: string
  ) {
    return (
      <div
        key={which}
        onPointerDown={(e) => startDrag(e, which, "move", zone)}
        className={`absolute border-2 ${colors} cursor-move touch-none select-none`}
        style={{
          left: `${zone.x * 100}%`,
          top: `${zone.y * 100}%`,
          width: `${zone.w * 100}%`,
          height: `${zone.h * 100}%`,
        }}
      >
        <span className="absolute top-0 left-0 text-[10px] font-bold text-white px-1.5 py-0.5 bg-black/55 rounded-br">
          {label}
        </span>
        <div
          onPointerDown={(e) => startDrag(e, which, "resize", zone)}
          className={`absolute bottom-0 right-0 w-4 h-4 ${handleColors} cursor-nwse-resize touch-none`}
          title="Drag to resize"
        />
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Media kit template"
          draggable={false}
          className="block w-full h-auto select-none"
          onLoad={(e) => {
            naturalRef.current = {
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            };
            forceRender((n) => n + 1);
          }}
        />
        {renderBox("logo", logoZone, "LOGO", "border-blue-500 bg-blue-500/10", "bg-blue-500")}
        {renderBox("qr", qrZone, "QR CODE", "border-emerald-600 bg-emerald-500/10", "bg-emerald-600")}
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">
        Drag a box to move it; drag its bottom-right corner to resize. The QR box stays square.
        {naturalRef.current
          ? ` Image is ${naturalRef.current.w}×${naturalRef.current.h}px.`
          : ""}
      </p>
      <p className="text-[11px] text-gray-400 font-mono">
        QR {pct(qrZone)} · Logo {pct(logoZone)}
      </p>
    </div>
  );
}

function pct(z: MediaKitZone): string {
  const f = (n: number) => `${Math.round(n * 100)}%`;
  return `${f(z.w)}×${f(z.h)} at ${f(z.x)},${f(z.y)}`;
}

/* ---------------- One template (flyer or social) ---------------- */

function TemplateEditor({
  kind,
  title,
  hint,
  initial,
  onSaved,
}: {
  kind: MediaKitKind;
  title: string;
  hint: string;
  initial: TemplateData | null;
  onSaved: (t: TemplateData) => void;
}) {
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [qrZone, setQrZone] = useState<MediaKitZone>(initial?.qrZone || DEFAULT_QR_ZONE);
  const [logoZone, setLogoZone] = useState<MediaKitZone>(initial?.logoZone || DEFAULT_LOGO_ZONE);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [replaced, setReplaced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) return;
    setImageUrl(initial.imageUrl);
    setQrZone(initial.qrZone);
    setLogoZone(initial.logoZone);
    // Only hydrate once per kind; later edits are local until Save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.imageUrl]);

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await workspaceFetch("/api/admin/sponsors/media-kit-templates/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        setReplaced(true);
        setMessage({ ok: true, text: "Image uploaded. Check the zone placement below, then Save." });
      } else {
        setMessage({ ok: false, text: data.error || "Upload failed." });
      }
    } catch {
      setMessage({ ok: false, text: "Upload failed (network error)." });
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await workspaceFetch("/api/admin/sponsors/media-kit-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, imageUrl, qrZone, logoZone }),
      });
      const data = await res.json();
      if (res.ok && data.template) {
        onSaved(data.template);
        setReplaced(false);
        setMessage({ ok: true, text: "Saved ✓" });
      } else {
        setMessage({ ok: false, text: data.error || "Save failed." });
      }
    } catch {
      setMessage({ ok: false, text: "Save failed (network error)." });
    }
    setSaving(false);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : imageUrl ? "Replace Image" : "Upload Image"}
          </button>
          <button
            onClick={save}
            disabled={saving || !imageUrl}
            className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {imageUrl ? (
        <ZoneEditor
          imageUrl={imageUrl}
          qrZone={qrZone}
          logoZone={logoZone}
          onQrChange={setQrZone}
          onLogoChange={setLogoZone}
        />
      ) : (
        <p className="text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-6 text-center">
          No template uploaded yet. Upload your finished design with blank space left for the QR code and the logo.
        </p>
      )}
      {replaced && imageUrl && (
        <p className="text-xs text-amber-600 font-medium">
          New image in place — the zones kept their positions from the previous image. Check they still land on the blank spots, then Save.
        </p>
      )}
      {message && (
        <p className={`text-xs font-medium ${message.ok ? "text-green-600" : "text-red-600"}`}>{message.text}</p>
      )}
    </div>
  );
}

/* ---------------- Templates card (top of the Profiles tab) ---------------- */

export function MediaKitTemplatesCard() {
  const [templates, setTemplates] = useState<Record<MediaKitKind, TemplateData | null> | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await workspaceFetch("/api/admin/sponsors/media-kit-templates");
        const data = await res.json();
        if (res.ok) setTemplates(data.templates);
        else setLoadError(true);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  return (
    <div id="media-kit-templates" className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Media Kit Templates</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Your flyer and social designs for this workspace. Each sponsor&apos;s media kit drops their QR code and
          logo (or their business name, if they have no logo) into the boxes you place here.
        </p>
      </div>
      {loadError ? (
        <p className="text-sm text-red-600">Could not load the media kit templates. Refresh to try again.</p>
      ) : templates === null ? (
        <p className="text-sm text-gray-400">Loading templates…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TemplateEditor
            kind="flyer"
            title="Flyer Template (8.5×11)"
            hint="Print piece. 2550×3300px (300 DPI) recommended; whatever you upload sets the output resolution."
            initial={templates.flyer}
            onSaved={(t) => setTemplates((cur) => (cur ? { ...cur, flyer: t } : cur))}
          />
          <TemplateEditor
            kind="social"
            title="Social Template"
            hint="Square share graphic, 1000×1000px recommended."
            initial={templates.social}
            onSaved={(t) => setTemplates((cur) => (cur ? { ...cur, social: t } : cur))}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- Per-sponsor preview + send modal ---------------- */

export function MediaKitModal({
  profile,
  workspaceName,
  workspaceArea,
  onClose,
  onSent,
}: {
  profile: ProfileLite;
  workspaceName: string;
  workspaceArea: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [status, setStatus] = useState<"checking" | "ready" | "missing" | "error">("checking");
  const [missing, setMissing] = useState<MediaKitKind[]>([]);
  const [to, setTo] = useState(profile.email);
  const [subject, setSubject] = useState(`Your ${workspaceName || "The Gist"} media kit`);
  const [body, setBody] = useState(() =>
    defaultKitEmailBody({
      contactName: profile.contactName,
      businessName: profile.businessName,
      landingUrl: profile.joinUrl,
      newsletterName: workspaceName,
      area: workspaceArea,
    })
  );
  const [preview, setPreview] = useState<{
    flyerPreview: string;
    socialPreview: string;
    usedLogoFallback: boolean;
    logoFallbackReason: string | null;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await workspaceFetch("/api/admin/sponsors/media-kit-templates");
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const miss = (["flyer", "social"] as MediaKitKind[]).filter((k) => !data.templates?.[k]);
        setMissing(miss);
        setStatus(miss.length > 0 ? "missing" : "ready");
      } catch {
        setStatus("error");
      }
    })();
  }, []);

  async function loadPreview() {
    setPreviewing(true);
    setPreviewError("");
    try {
      const res = await workspaceFetch(`/api/admin/sponsors/profiles/${profile.id}/media-kit/preview`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) setPreview(data);
      else setPreviewError(data.error || "Preview failed.");
    } catch {
      setPreviewError("Preview failed (network error).");
    }
    setPreviewing(false);
  }

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await workspaceFetch(`/api/admin/sponsors/profiles/${profile.id}/media-kit/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (res.ok) {
        const names = (data.attachments || []).join(", ");
        setResult({
          ok: true,
          message:
            `Media kit sent to ${to}. Attached: ${names}.` +
            (data.flyerPngDropped ? " The flyer PNG was left off to stay under the 10 MB email limit; the print-ready PDF went instead." : "") +
            (data.usedLogoFallback && data.logoFallbackReason ? ` Note: ${data.logoFallbackReason}` : ""),
        });
        onSent();
      } else {
        setResult({ ok: false, message: data.error || "Send failed." });
      }
    } catch {
      setResult({ ok: false, message: "Send failed (network error)." });
    }
    setSending(false);
  }

  function goToTemplates() {
    onClose();
    setTimeout(() => {
      document.getElementById("media-kit-templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">Media Kit — {profile.businessName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Their flyer and social graphic, built from your templates with their QR code and logo.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">✕</button>
        </div>

        {status === "checking" && <p className="text-sm text-gray-400">Checking templates…</p>}
        {status === "error" && <p className="text-sm text-red-600">Could not check the media kit templates. Close and try again.</p>}
        {status === "missing" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
            <p className="text-sm text-amber-800">
              Media kit templates are not set up for this workspace yet (missing: {missing.join(" and ")}).
              Add them in the Media Kit Templates section at the top of this tab, then come back here.
            </p>
            <button onClick={goToTemplates} className="text-xs font-semibold text-amber-800 underline">
              Go to Media Kit Templates
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
              <textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">Plain text — blank lines become paragraphs, single line breaks are preserved.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={loadPreview}
                  disabled={previewing}
                  className="px-3 py-1.5 border border-green-200 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-50 disabled:opacity-50"
                >
                  {previewing ? "Building preview…" : preview ? "Rebuild Preview" : "Preview Kit"}
                </button>
                <p className="text-xs text-gray-400">Attaches: flyer PDF (print), flyer PNG, social PNG, QR PNG.</p>
              </div>
              {previewError && <p className="text-sm text-red-600 font-medium">{previewError}</p>}
              {preview && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3 items-start">
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.flyerPreview} alt="Flyer preview" className="w-full rounded-lg border border-gray-200" />
                      <figcaption className="text-[11px] text-gray-400 mt-1">Flyer</figcaption>
                    </figure>
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.socialPreview} alt="Social preview" className="w-full rounded-lg border border-gray-200" />
                      <figcaption className="text-[11px] text-gray-400 mt-1">Social</figcaption>
                    </figure>
                  </div>
                  {preview.usedLogoFallback && preview.logoFallbackReason && (
                    <p className="text-xs text-amber-600 font-medium">{preview.logoFallbackReason} Their business name appears in the logo spot.</p>
                  )}
                  <p className="text-[11px] text-gray-400">Previews are scaled down; the email attaches full-resolution files.</p>
                </div>
              )}
            </div>

            {result && (
              <p className={`text-sm font-medium ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.message}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={send}
                disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
              >
                {sending ? "Building & Sending…" : "Send Kit"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50"
              >
                {result?.ok ? "Close" : "Cancel"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
