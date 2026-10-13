"use client";
import { workspaceFetch, workspacePath } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import WsBadge from "@/app/admin/components/WsBadge";

import { useCallback, useEffect, useState, useRef } from "react";

interface WsInfo {
  id: string;
  slug: string;
  name: string;
  primaryColor: string;
}

interface Subscriber {
  id: string;
  email: string;
  firstName: string | null;
  subscribedAt: string;
  active: boolean;
  workspace?: { slug: string; name: string };
}

interface DealsCustomer {
  id: string;
  email: string;
  createdAt: string;
  active: boolean;
  digestOptOut: boolean;
  workspace: { slug: string; name: string };
}

const PAGE_SIZE = 50;

export default function ListsPage() {
  const { workspace: activeWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<WsInfo[]>([]);
  const [wsSel, setWsSel] = useState("all");
  const [listTab, setListTab] = useState<"newsletter" | "deals">("newsletter");

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [newsTotal, setNewsTotal] = useState(0);
  const [newsPage, setNewsPage] = useState(1);
  const [newsLoading, setNewsLoading] = useState(true);

  const [customers, setCustomers] = useState<DealsCustomer[]>([]);
  const [dealsTotal, setDealsTotal] = useState(0);
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsLoading, setDealsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    workspaceFetch("/api/admin/workspaces").then(async (r) => {
      if (r.ok) setWorkspaces((await r.json()).workspaces || []);
    });
  }, []);

  const colorOf = useCallback(
    (slug: string) => workspaces.find((w) => w.slug === slug)?.primaryColor,
    [workspaces]
  );

  const fetchNewsletter = useCallback(async (s: string, p: number) => {
    setNewsLoading(true);
    try {
      const params = new URLSearchParams({ search: s, page: String(p), workspace: wsSel });
      const res = await workspaceFetch(`/api/admin/subscribers?${params}`);
      const data = await res.json();
      setSubscribers(data.subscribers || []);
      setNewsTotal(data.total || 0);
    } finally {
      setNewsLoading(false);
    }
  }, [wsSel]);

  const fetchDealsCustomers = useCallback(async (s: string, p: number) => {
    setDealsLoading(true);
    try {
      const params = new URLSearchParams({ search: s, page: String(p), workspace: wsSel });
      const res = await workspaceFetch(`/api/admin/deals/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setDealsTotal(data.total || 0);
    } finally {
      setDealsLoading(false);
    }
  }, [wsSel]);

  // Load both list totals whenever the workspace filter changes; load the
  // visible tab's rows.
  useEffect(() => {
    setNewsPage(1);
    setDealsPage(1);
    fetchNewsletter(search, 1);
    fetchDealsCustomers(search, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsSel]);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (listTab === "newsletter") {
      setNewsPage(1);
      fetchNewsletter(val, 1);
    } else {
      setDealsPage(1);
      fetchDealsCustomers(val, 1);
    }
  }

  function switchTab(tab: "newsletter" | "deals") {
    setListTab(tab);
    if (tab === "newsletter") fetchNewsletter(search, newsPage);
    else fetchDealsCustomers(search, dealsPage);
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Remove ${email} from the list?`)) return;
    await workspaceFetch("/api/admin/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchNewsletter(search, newsPage);
  }

  function parseCSV(text: string): { email: string; firstName?: string }[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];

    // Detect if first row is a header
    const firstRow = lines[0].toLowerCase();
    const hasHeader = firstRow.includes("email") || !firstRow.includes("@");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Detect delimiter
    const delim = lines[0].includes("\t") ? "\t" : ",";

    // Try to find email and first_name column indexes from header
    let emailIdx = 0;
    let firstNameIdx = 1;
    if (hasHeader) {
      const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      const eIdx = headers.findIndex((h) => h.includes("email"));
      const fIdx = headers.findIndex((h) => h.includes("first") || h === "name" || h === "firstname");
      if (eIdx !== -1) emailIdx = eIdx;
      if (fIdx !== -1) firstNameIdx = fIdx;
    }

    return dataLines
      .map((line) => {
        const cols = line.split(delim).map((c) => c.trim().replace(/^["']|["']$/g, ""));
        const email = cols[emailIdx]?.toLowerCase() || "";
        const firstName = cols[firstNameIdx] || undefined;
        return { email, firstName: firstName || undefined };
      })
      .filter((r) => r.email.includes("@"));
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportError("");

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        setImportError("No valid email addresses found in the file.");
        return;
      }

      const res = await workspaceFetch("/api/admin/subscribers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribers: parsed }),
      });
      const data = await res.json();

      if (res.ok) {
        setImportResult(data);
        fetchNewsletter(search, 1);
      } else {
        setImportError(data.error || "Import failed.");
      }
    } catch {
      setImportError("Failed to read file. Make sure it's a valid CSV.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportCSV() {
    window.location.href = workspacePath("/api/admin/subscribers/export");
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${
      active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
    }`;

  // Import/export act on the current admin workspace context, so they are
  // only offered when the filter matches it — never silently import into the
  // wrong workspace.
  const canImportExport = wsSel === activeWorkspace.slug;

  const newsPages = Math.ceil(newsTotal / PAGE_SIZE);
  const dealsPages = Math.ceil(dealsTotal / PAGE_SIZE);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Lists</h1>
          <WsBadge
            name={wsSel === "all" ? "All workspaces" : workspaces.find((w) => w.slug === wsSel)?.name || activeWorkspace.name}
            color={wsSel === "all" ? "#111827" : colorOf(wsSel)}
            size="md"
          />
        </div>
        <p className="text-gray-500 text-sm mt-1">
          {newsTotal.toLocaleString()} newsletter subscriber{newsTotal !== 1 ? "s" : ""} ·{" "}
          {dealsTotal.toLocaleString()} Deals customer{dealsTotal !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Workspace filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setWsSel("all")} className={tabCls(wsSel === "all")}>
          All workspaces
        </button>
        {workspaces.map((w) => (
          <button key={w.slug} onClick={() => setWsSel(w.slug)} className={tabCls(wsSel === w.slug)}>
            {w.name}
          </button>
        ))}
      </div>

      {/* List tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={() => switchTab("newsletter")} className={tabCls(listTab === "newsletter")}>
          Newsletter subscribers ({newsTotal.toLocaleString()})
        </button>
        <button onClick={() => switchTab("deals")} className={tabCls(listTab === "deals")}>
          Deals customers ({dealsTotal.toLocaleString()})
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {listTab === "newsletter" && canImportExport && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileImport}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className={`cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${importing ? "opacity-60 pointer-events-none" : ""}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {importing ? "Importing…" : "Import CSV"}
              </label>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export CSV
              </button>
            </>
          )}
          {listTab === "newsletter" && !canImportExport && (
            <p className="text-xs text-gray-400">
              Import/export act on the {activeWorkspace.name} workspace — filter to it above to use them.
            </p>
          )}
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
          Import complete: <strong>{importResult.imported}</strong> added
          {importResult.skipped > 0 && `, ${importResult.skipped} skipped (duplicates or invalid)`}
        </div>
      )}
      {importError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
          {importError}
        </div>
      )}

      {/* CSV format hint */}
      {listTab === "newsletter" && canImportExport && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
          <strong>CSV format:</strong> Any CSV with an <code>email</code> column works. Optional <code>first_name</code> column is auto-detected. Headers are optional.
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Newsletter table */}
      {listTab === "newsletter" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {newsLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : subscribers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {search ? "No subscribers match your search." : "No subscribers yet. Import a CSV or share your signup page."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">List</th>
                    {wsSel === "all" && (
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Workspace</th>
                    )}
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Subscribed</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{sub.email}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Newsletter</span>
                      </td>
                      {wsSel === "all" && (
                        <td className="px-5 py-3">
                          {sub.workspace && <WsBadge name={sub.workspace.name} color={colorOf(sub.workspace.slug)} />}
                        </td>
                      )}
                      <td className="px-5 py-3 text-gray-500">{sub.firstName || <span className="text-gray-300">N/A</span>}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {new Date(sub.subscribedAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sub.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sub.active ? "bg-green-500" : "bg-gray-400"}`} />
                          {sub.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(sub.id, sub.email)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove subscriber"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Deals customers table */}
      {listTab === "deals" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dealsLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {search ? "No Deals customers match your search." : "No Deals books sold yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">List</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Workspace</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Purchased</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Digest</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{c.email}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Deals customers</span>
                      </td>
                      <td className="px-5 py-3">
                        <WsBadge name={c.workspace.name} color={colorOf(c.workspace.slug)} />
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {new Date(c.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.active ? "bg-green-500" : "bg-gray-400"}`} />
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {c.digestOptOut ? "Opted out" : "Subscribed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {listTab === "newsletter" && newsPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <p>Showing {((newsPage - 1) * PAGE_SIZE) + 1} to {Math.min(newsPage * PAGE_SIZE, newsTotal)} of {newsTotal.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setNewsPage(newsPage - 1); fetchNewsletter(search, newsPage - 1); }}
              disabled={newsPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span>Page {newsPage} of {newsPages}</span>
            <button
              onClick={() => { setNewsPage(newsPage + 1); fetchNewsletter(search, newsPage + 1); }}
              disabled={newsPage === newsPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {listTab === "deals" && dealsPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <p>Showing {((dealsPage - 1) * PAGE_SIZE) + 1} to {Math.min(dealsPage * PAGE_SIZE, dealsTotal)} of {dealsTotal.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDealsPage(dealsPage - 1); fetchDealsCustomers(search, dealsPage - 1); }}
              disabled={dealsPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span>Page {dealsPage} of {dealsPages}</span>
            <button
              onClick={() => { setDealsPage(dealsPage + 1); fetchDealsCustomers(search, dealsPage + 1); }}
              disabled={dealsPage === dealsPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
