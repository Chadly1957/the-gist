import Link from "next/link";
import { prisma } from "@/lib/db";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = await prisma.newsletterSend.findMany({
    where: { status: "sent", htmlSnapshot: { not: null } },
    select: { id: true, subject: true, sentAt: true, recipientCount: true },
    orderBy: { sentAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-8 sm:py-12 text-center">
        <Link href="/" className="flex items-center justify-center mb-6">
          <Logo className="h-10 sm:h-14 w-auto" />
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Past Issues</h1>
        <p className="text-gray-500">Browse every edition of The Gist Decatur.</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {issues.length === 0 ? (
          <p className="text-center text-gray-400 py-16">No issues published yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {issues.map((issue) => {
              const date = new Date(issue.sentAt).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "America/Chicago",
              });
              return (
                <div key={issue.id} className="py-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 leading-snug">{issue.subject}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{date}</p>
                  </div>
                  <Link
                    href={`/issues/${issue.id}`}
                    className="shrink-0 text-sm font-semibold text-green-700 hover:text-green-800 border border-green-200 hover:border-green-400 px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Read
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
