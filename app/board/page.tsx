import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import WorkspaceText from "@/components/workspace/WorkspaceText";
import { getWorkspace } from "@/lib/workspace";
import { getActiveBoardPosts, boardCategoryLabel } from "@/lib/board";

export const dynamic = "force-dynamic";

// Public Board page: live community classifieds for this workspace,
// newest approvals first, plus the way in to post something.
export default async function BoardPage() {
  const ws = await getWorkspace();
  const posts = await getActiveBoardPosts(ws.id);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">The Gist Board</h1>
          <p className="text-gray-500">
            <WorkspaceText>{"Community classifieds, posted by your neighbors."}</WorkspaceText>
          </p>
          <Link
            href="/board/post"
            className="inline-block mt-6 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Post something — just $5 for 7 days
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-500 text-sm mb-1">Nothing on the board this week.</p>
            <p className="text-gray-400 text-sm">Be the first to post.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">
                  {boardCategoryLabel(p.category)}
                </p>
                <p className="font-bold text-gray-900">{p.title}</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{p.description}</p>
                {p.displayName && (
                  <p className="text-xs text-gray-400 mt-2">Posted by {p.displayName}</p>
                )}
                {p.contactInfo && (
                  <p className="text-xs text-gray-500 mt-1">Contact: {p.contactInfo}</p>
                )}
                {p.linkUrl && (
                  <a
                    href={p.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-sm font-semibold text-green-700 hover:underline"
                  >
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
