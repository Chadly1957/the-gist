import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import EventsSubscribe from "@/components/EventsSubscribe";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ws = await getWorkspace();
  return {
    title: `Dinner Club | ${ws.name}`,
    description: `A monthly dinner club in ${ws.area}: take a short quiz, get matched into a table of six, and enjoy dinner and an afterparty. First dinner Thursday, December 10, 2026 at 6:30 PM.`,
  };
}

// Public dinner club page for this workspace: the DNNR dinner club.
// Readers take a quiz and are matched into tables of six; DNNR books
// the restaurant and the afterparty. First dinner is Thursday,
// December 10, 2026 at 6:30 PM, then the second Thursday of every
// month. A seat is $15.99 (dinner itself is pay-your-own), and each
// dinner night needs at least 30 people signed up to run.
export default async function DinnerClubPage() {
  const ws = await getWorkspace();

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
            The Gist {ws.area} Dinner Club
          </p>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Dinner Club in {ws.area} IL
          </h1>
          <p className="text-gray-500">
            A monthly night out with good company. Take a short quiz, get
            matched into a table of six, and show up for dinner and an
            afterparty. We handle the matching and the booking, you just
            bring yourself.
          </p>
          <div className="inline-block mt-6 bg-green-50 border border-green-100 rounded-2xl px-5 py-4 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700">
              First dinner
            </p>
            <p className="font-bold text-gray-900 mt-1">
              Thursday, December 10, 2026 at 6:30 PM
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Then the second Thursday of every month.
            </p>
          </div>
        </div>

        {/*
          ============================================================
          DNNR EMBED GOES HERE
          Paste the DNNR embed code (script + container) inside this
          section, replacing the placeholder box below. The embed
          handles the quiz, the table matching, and seat registration.
          Nothing else on this page needs to change.
          ============================================================
        */}
        <div id="dnnr-embed" className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 text-center">
            Save your seat
          </h2>
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <p className="font-bold text-gray-900 mb-1">
              Registration opens here
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">
              The DNNR signup embed goes in this spot. It runs the quiz,
              matches you into a table of six, and reserves your seat.
            </p>
          </div>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
          How it works
        </h2>
        <div className="space-y-4 mb-10">
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">1. Take the quiz</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Answer a few quick questions about what you like, and we
              match you with five other people you will actually enjoy
              sitting with.
            </p>
          </div>
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">2. Get your table</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              DNNR matches you into a table of six and books the
              restaurant, so nobody has to organize anything.
            </p>
          </div>
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">3. Show up</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Dinner at your table, then an afterparty with the whole
              group. Same night, same crowd, two parts.
            </p>
          </div>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
          The details
        </h2>
        <div className="space-y-4 mb-10">
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">A seat is $15.99</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              That reserves your matched seat for the night. Dinner itself
              is pay-your-own at the table, so you order what you want.
            </p>
          </div>
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">
              Each dinner needs at least 30 people
            </p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              That is the minimum for a dinner night to run. If we do not
              hit 30 signed up, the night does not happen.
            </p>
          </div>
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">Once a month, same rhythm</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              The second Thursday of every month, 6:30 PM. First dinner is
              Thursday, December 10, 2026.
            </p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">
            Presenting sponsor
          </p>
          <p className="font-bold text-gray-900">Little Olive Daycare</p>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
            Our presenting sponsor owns the afterparty, with signage,
            handouts, and time to mingle with the whole group.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
            <p className="font-bold text-gray-900 mb-1">Get this in your inbox</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              The free morning email with {ws.area}&apos;s news, deals, and
              events, in your inbox before your coffee gets cold.
            </p>
            <EventsSubscribe />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900 mb-1">Own a local business?</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Put your business in front of {ws.area} readers every morning.
            </p>
            <Link
              href="/sponsor"
              className="inline-block px-4 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
            >
              Advertise with The Gist
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
