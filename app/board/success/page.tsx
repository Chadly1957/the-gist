import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/db";
import { boardRunWeeksLabel, clampBoardRunWeeks } from "@/lib/board-constants";

export const dynamic = "force-dynamic";

// The checkout success URL carries the Stripe session id; the BoardPost
// row stored that same id before redirecting to Stripe, so the purchased
// run length comes from the database, never from the URL itself.
export default async function BoardSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  let runWeeks: number | null = null;
  const sessionId = searchParams?.session_id;
  if (sessionId) {
    try {
      const post = await prisma.boardPost.findUnique({
        where: { stripeSessionId: sessionId },
        select: { runWeeks: true },
      });
      if (post) runWeeks = clampBoardRunWeeks(post.runWeeks);
    } catch {
      runWeeks = null;
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">📌</div>
          <h1 className="text-2xl font-bold text-gray-900">Your post is live</h1>
          <p className="text-gray-500 mt-3">
            {runWeeks
              ? `Thanks! Your post is live now, and it runs for ${boardRunWeeksLabel(runWeeks)} in the newsletter and on the Board page. Your receipt is on its way by email.`
              : "Thanks! Your post is live now, and it runs in the newsletter and on the Board page for the run length you picked. Your receipt is on its way by email."}
          </p>
          <Link href="/board" className="inline-block mt-6 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800">
            View the Board
          </Link>
        </div>
      </div>
    </div>
  );
}
