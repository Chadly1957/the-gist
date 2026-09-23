"use client";
import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import Link from "./WorkspaceLink";
import { workspaceFetch } from "@/lib/workspace-client";
import RecentIssues from "@/components/RecentIssues";
import SponsorsMarquee from "@/components/SponsorsMarquee";
export default function CommunityHome() {
  const { workspace } = useWorkspace();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function subscribe(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const res = await workspaceFetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, firstName }) });
      const data = await res.json();
      setSuccess(res.ok); setMessage(res.ok ? `Welcome to ${workspace.name}!` : data.error || "Please try again.");
    } catch { setSuccess(false); setMessage("Could not subscribe. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-stone-50 text-gray-900">
    <header className="max-w-6xl mx-auto flex flex-wrap justify-between gap-5 px-6 py-7 border-b border-stone-200"><Link href="/" className="text-2xl font-bold tracking-tight">{workspace.name}<span className="text-green-700">.</span></Link><nav className="flex gap-5 text-sm font-medium items-center"><Link href="/issues">Recent issues</Link><Link href="/games">Games</Link><Link href="/sponsor">Partner with us</Link></nav></header>
    <main className="max-w-6xl mx-auto px-6"><section className="py-20 md:py-28 max-w-3xl"><p className="uppercase tracking-widest font-bold text-green-700 text-xs">Your daily local briefing</p><h1 className="mt-5 text-5xl md:text-7xl font-bold tracking-tight leading-tight">A little more local.<br />A lot more {workspace.area}.</h1><p className="mt-7 text-lg text-gray-600 max-w-xl">The stories, people, and things to do that make {workspace.area} home. Get {workspace.name} in your inbox.</p>
    <form onSubmit={subscribe} className="mt-8 max-w-xl space-y-3"><label className="sr-only" htmlFor="firstName">First name</label><input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name (optional)" className="w-full bg-white rounded-lg border p-3" /><label className="sr-only" htmlFor="email">Email address</label><div className="flex flex-col sm:flex-row gap-3"><input id="email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" className="min-w-0 flex-1 bg-white rounded-lg border p-3" /><button disabled={busy || success} className="rounded-lg px-6 py-3 bg-green-800 text-white font-semibold disabled:opacity-50">{busy ? "Joining…" : success ? "You're on the list" : "Get the newsletter"}</button></div>{message && <p role="status" className={success ? "text-green-800" : "text-red-700"}>{message}</p>}</form></section><RecentIssues /><SponsorsMarquee /></main>
    <footer className="max-w-6xl mx-auto px-6 py-10 mt-16 border-t text-sm text-gray-500">© {new Date().getFullYear()} {workspace.name}</footer>
  </div>;
}
