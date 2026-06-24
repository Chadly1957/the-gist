import Link from "next/link";
import { prisma } from "@/lib/db";

// Always render at request time — requires DB access, not available at build
export const dynamic = "force-dynamic";

async function getDashboardStats() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
    const thirtyDaysOutStr = thirtyDaysOut.toISOString().split("T")[0];

    const [subscribers, sources, articles, lastSend, sponsorProfiles, activeSpotlights, pendingBookings, upcomingBookings] = await Promise.all([
      prisma.subscriber.count({ where: { active: true } }),
      prisma.source.count({ where: { active: true } }),
      prisma.article.count(),
      prisma.newsletterSend.findFirst({ orderBy: { sentAt: "desc" } }),
      prisma.sponsorProfile.count(),
      prisma.spotlightListing.count({ where: { status: "approved" } }),
      prisma.adBooking.count({ where: { status: "pending" } }),
      prisma.adBooking.count({ where: { status: "approved", date: { gte: today, lte: thirtyDaysOutStr } } }),
    ]);
    return { subscribers, sources, articles, lastSend, sponsorProfiles, activeSpotlights, pendingBookings, upcomingBookings };
  } catch {
    return { subscribers: 0, sources: 0, articles: 0, lastSend: null, sponsorProfiles: 0, activeSpotlights: 0, pendingBookings: 0, upcomingBookings: 0 };
  }
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
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
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
            value: lastSendDate ? stats.lastSend!.recipientCount.toString() : "N/A",
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

      {/* Sponsors at a Glance */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">Sponsors</h2>
          <Link href="/admin/sponsors" className="text-xs text-green-700 hover:underline font-medium">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Profiles Created",
              value: stats.sponsorProfiles.toLocaleString(),
              sub: "total community partners",
              color: "text-amber-600",
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              label: "Active Spotlights",
              value: stats.activeSpotlights.toLocaleString(),
              sub: "approved free listings",
              color: "text-green-600",
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              ),
            },
            {
              label: "Pending Review",
              value: stats.pendingBookings.toLocaleString(),
              sub: "ad bookings awaiting approval",
              color: stats.pendingBookings > 0 ? "text-orange-500" : "text-gray-400",
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              label: "Upcoming Ads",
              value: stats.upcomingBookings.toLocaleString(),
              sub: "approved in next 30 days",
              color: "text-blue-600",
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${stat.color}`}>{stat.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stat.sub}</p>
              </div>
            </div>
          ))}
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
        <div className="overflow-x-auto">
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
    </div>
  );
}
