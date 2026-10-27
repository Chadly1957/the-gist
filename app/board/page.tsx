import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import WorkspaceText from "@/components/workspace/WorkspaceText";
import { getWorkspace } from "@/lib/workspace";
import { getActiveBoardPosts, boardCategoryLabel } from "@/lib/board";
import { BOARD_INTENTS } from "@/lib/board-constants";

export const dynamic = "force-dynamic";

// Public Board landing page + live list for this workspace: what the Board
// is, what you can post, how it works, then the live posts themselves,
// newest approvals first.
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
          <p className="text-gray-600 text-sm leading-relaxed mt-3 max-w-lg mx-auto">
            Got something worth sharing with the whole town? Put it on the Board and it
            runs in the morning newsletter and right here for 7 days. No meetings, no
            pitches, no waiting on anyone to say yes. Just post it.
          </p>
          <Link
            href="/board/post"
            className="inline-block mt-6 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Post something — just $5 for 7 days
          </Link>
        </div>

        <div className="mb-12">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">What can you post?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BOARD_INTENTS.map((opt) => (
              <Link
                key={opt.key}
                href={`/board/post?intent=${opt.key}`}
                className="block bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-600 rounded-xl px-4 py-3.5 transition-colors"
              >
                <span className="block text-sm font-semibold text-gray-900">{opt.label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{opt.blurb}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">How it works</h2>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3"><span className="font-bold text-green-700 shrink-0">1.</span>Pick what you are sharing and write it in a minute. Title, a line or two, and a link or way to reach you.</li>
            <li className="flex gap-3"><span className="font-bold text-green-700 shrink-0">2.</span>Pay $5 at checkout. That is the whole price, no subscription, no upsell.</li>
            <li className="flex gap-3"><span className="font-bold text-green-700 shrink-0">3.</span>We give it a quick review, then it runs in every weekday issue for 7 days and stays on this page.</li>
          </ol>
          <p className="text-xs text-gray-400 mt-4">
            If a post is rejected, the $5 is refunded in full. Anyone can post, readers and businesses alike.
          </p>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">On the board this week</h2>

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
