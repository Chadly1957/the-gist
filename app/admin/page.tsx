import Link from "next/link";
import { prisma } from "@/lib/db";

// Always render at request time — requires DB access, not available at build
export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const [subscribers, sources, articles, lastSend] = await Promise.all([
    prisma.subscriber.count({ where: { active: true } }),
    prisma.source.count({ where: { active: true } }),
    prisma.article.count(),
    prisma.newsletterSend.findFirst({ orderBy: { sentAt: "desc" } }),
  ]);
  return { subscribers, sources, articles, lastSend };
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  const lastSendDate = stats.lastSend
    ? new Date(stats.lastSend.sentAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Subscribers",
            value: stats.subscribers.toLocaleString(),
            sub: "active",
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Sources",
            value: stats.sources.toLocaleString(),
            sub: "active feeds",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Articles",
            value: stats.articles.toLocaleString(),
            sub: "in pool",
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Last Send",
            value: lastSendDate ? stats.lastSend!.recipientCount.toString() : "—",
            sub: lastSendDate ? `sent ${lastSendDate}` : "No sends yet",
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {stat.label}
            </p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-700 mb-4">
          Quick Actions
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/admin/compose"
            className="flex items-center gap-4 p-5 bg-green-700 hover:bg-green-800 text-white rounded-xl transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Compose Newsletter</p>
              <p className="text-green-200 text-xs mt-0.5">Scrape, review &amp; send today's issue</p>
            </div>
          </Link>

          <Link
            href="/admin/sources"
            className="flex items-center gap-4 p-5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Manage Sources</p>
              <p className="text-gray-400 text-xs mt-0.5">{stats.sources} active sources</p>
            </div>
          </Link>

          <Link
            href="/admin/templates"
            className="flex items-center gap-4 p-5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 text-purple-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Edit Template</p>
              <p className="text-gray-400 text-xs mt-0.5">Design your newsletter layout</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent sends */}
      <RecentSends />
    </div>
  );
}

async function RecentSends() {
  const sends = await prisma.newsletterSend.findMany({
    orderBy: { sentAt: "desc" },
    take: 5,
  });

  if (sends.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Recent Sends
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Subject
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Sent
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Recipients
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sends.map((send) => (
              <tr key={send.id} className="border-b border-gray-100 last:border-0">
                <td className="px-5 py-3 font-medium text-gray-800">
                  {send.subject}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {new Date(send.sentAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {send.recipientCount.toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {send.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
