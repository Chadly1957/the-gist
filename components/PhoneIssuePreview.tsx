"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { workspaceFetch } from "@/lib/workspace-client";

type LatestIssue = {
  subject: string;
  sentAt: string;
  html: string;
};

// Gentle auto-scroll: slow enough to read headlines as they drift by,
// fast enough that the preview feels alive.
const SCROLL_PX_PER_SECOND = 28;
const END_DWELL_MS = 1500;
const RESUME_AFTER_IDLE_MS = 3000;

function formatSentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

export default function PhoneIssuePreview({
  heroSrc,
  heroAlt,
}: {
  heroSrc: string;
  heroAlt: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [issue, setIssue] = useState<LatestIssue | null>(null);
  const [contentHeight, setContentHeight] = useState(1200);
  const [reducedMotion, setReducedMotion] = useState(false);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pausedRef = useRef(false);
  const directionRef = useRef<1 | -1>(1);
  const autoScrollRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    workspaceFetch("/api/issues/latest")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("latest issue fetch failed"))))
      .then((d) => {
        if (!alive) return;
        if (d?.issue?.html) {
          setIssue(d.issue);
          setStatus("ready");
        } else {
          setStatus("fallback");
        }
      })
      .catch(() => {
        if (alive) setStatus("fallback");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Measure the issue height once it loads (images can land late, so
  // re-measure a few times). The iframe is same-origin sandboxed, so the
  // parent can read its document height without letting its scripts run.
  useEffect(() => {
    if (status !== "ready") return;
    const frame = iframeRef.current;
    if (!frame) return;
    const measure = () => {
      try {
        const doc = frame.contentDocument;
        if (doc?.body) {
          const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
          if (h > 0) setContentHeight(h + 8);
        }
      } catch {
        // Sandbox without same-origin: keep the last measured height.
      }
    };
    frame.addEventListener("load", measure);
    measure();
    const t1 = setTimeout(measure, 800);
    const t2 = setTimeout(measure, 2500);
    return () => {
      frame.removeEventListener("load", measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [status, issue]);

  // Pause auto-scroll on any user interaction; resume after a short idle.
  const poke = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, RESUME_AFTER_IDLE_MS);
  }, []);

  const handleScreenScroll = useCallback(() => {
    // Scroll events fired by our own auto-scroll carry the flag; ignore those.
    if (autoScrollRef.current) {
      autoScrollRef.current = false;
      return;
    }
    poke();
  }, [poke]);

  useEffect(() => {
    if (status !== "ready" || reducedMotion) return;
    const screen = screenRef.current;
    if (!screen) return;
    let raf = 0;
    let last = performance.now();
    let dwellUntil = 0;
    let visible = true;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible = entry.isIntersecting;
    });
    observer.observe(screen);
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (visible && !pausedRef.current && now >= dwellUntil) {
        const max = screen.scrollHeight - screen.clientHeight;
        if (max > 0) {
          let next = screen.scrollTop + (directionRef.current * SCROLL_PX_PER_SECOND * dt) / 1000;
          if (next >= max) {
            next = max;
            directionRef.current = -1;
            dwellUntil = now + END_DWELL_MS;
          } else if (next <= 0) {
            next = 0;
            directionRef.current = 1;
            dwellUntil = now + END_DWELL_MS;
          }
          if (next !== screen.scrollTop) {
            autoScrollRef.current = true;
            screen.scrollTop = next;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [status, reducedMotion]);

  // Same slot and responsive visibility as the hero photo this replaces.
  return (
    <div className="hidden lg:flex items-center justify-center">
      <div className="relative w-full max-w-md">
        {status === "fallback" ? (
          <div className="rounded-3xl overflow-hidden">
            <Image
              src={heroSrc}
              alt={heroAlt}
              width={640}
              height={700}
              className="w-full h-auto object-cover"
              priority
            />
          </div>
        ) : (
          <>
            <div className="relative mx-auto w-[300px] rounded-[48px] bg-gray-950 p-2.5 shadow-2xl shadow-gray-400/40 ring-1 ring-gray-900">
              {/* Side buttons, decorative */}
              <div aria-hidden className="absolute -left-[2px] top-28 h-10 w-[3px] rounded-full bg-gray-700" />
              <div aria-hidden className="absolute -left-[2px] top-44 h-14 w-[3px] rounded-full bg-gray-700" />
              <div aria-hidden className="absolute -right-[2px] top-32 h-16 w-[3px] rounded-full bg-gray-700" />
              <div className="relative overflow-hidden rounded-[38px] bg-white">
                {/* Dynamic island */}
                <div aria-hidden className="pointer-events-none absolute left-1/2 top-2 z-20 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-gray-950" />
                {status === "loading" ? (
                  <div className="h-[560px] animate-pulse bg-gray-100 p-4 pt-12">
                    <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
                    <div className="mb-6 h-3 w-1/2 rounded bg-gray-200" />
                    <div className="mb-3 h-24 rounded-xl bg-gray-200" />
                    <div className="mb-3 h-24 rounded-xl bg-gray-200" />
                    <div className="h-24 rounded-xl bg-gray-200" />
                  </div>
                ) : (
                  issue && (
                    <div
                      ref={screenRef}
                      onScroll={handleScreenScroll}
                      onPointerDown={poke}
                      onWheel={poke}
                      onTouchStart={poke}
                      onMouseEnter={poke}
                      className="h-[560px] overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <iframe
                        ref={iframeRef}
                        srcDoc={issue.html}
                        // No scripts, no popups, no forms, no top navigation:
                        // the preview can never run email code or navigate
                        // the parent page. allow-same-origin only lets this
                        // component measure the content height. Links are
                        // additionally unreachable via pointer-events-none.
                        sandbox="allow-same-origin"
                        scrolling="no"
                        tabIndex={-1}
                        title={issue.subject}
                        className="pointer-events-none block w-full border-0"
                        style={{ height: contentHeight }}
                      />
                    </div>
                  )
                )}
              </div>
            </div>
            {status === "ready" && issue && (
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-gray-900">{issue.subject}</p>
                <p className="mt-0.5 text-xs text-gray-400">{formatSentDate(issue.sentAt)}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
