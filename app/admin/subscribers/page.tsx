"use client";

import { useEffect, useState, useRef } from "react";

interface Subscriber {
  id: string;
  email: string;
  firstName: string | null;
  subscribedAt: string;
  active: boolean;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchSubscribers(s = search, p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: s, page: String(p) });
      const res = await fetch(`/api/admin/subscribers?${params}`);
      const data = await res.json();
      setSubscribers(data.subscribers || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubscribers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    fetchSubscribers(val, 1);
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Remove ${email} from the list?`)) return;
    await fetch("/api/admin/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchSubscribers();
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

      const res = await fetch("/api/admin/subscribers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribers: parsed }),
      });
      const data = await res.json();

      if (res.ok) {
        setImportResult(data);
        fetchSubscribers(search, 1);
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
    window.location.href = "/api/admin/subscribers/export";
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString()} total subscriber{total !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* CSV Import */}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
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
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        <strong>CSV format:</strong> Any CSV with an <code>email</code> column works. Optional <code>first_name</code> column is auto-detected. Headers are optional.
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <p>Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, total)} of {total.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(page - 1); fetchSubscribers(search, page - 1); }}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => { setPage(page + 1); fetchSubscribers(search, page + 1); }}
              disabled={page === totalPages}
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
