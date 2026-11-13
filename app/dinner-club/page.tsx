import type { Metadata } from "next";
import Script from "next/script";
import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import EventsSubscribe from "@/components/EventsSubscribe";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ws = await getWorkspace();
  return {
    title: `Dinner Club | ${ws.name}`,
    description: `A monthly dinner in ${ws.area} for meeting new people over a good meal, with an afterparty after. First dinner Thursday, December 10, 2026 at 6:30 PM.`,
  };
}

// Public dinner club page for this workspace: a monthly dinner for
// meeting new people and having fun. Dinner together, then an
// afterparty with the whole group. Booking runs through the popup
// attached to the "Book a seat" button below. First dinner is
// Thursday, December 10, 2026 at 6:30 PM, then the second Thursday
// of every month. A seat is $15.99 (dinner itself is pay-your-own),
// and each dinner night needs at least 30 people signed up to run.
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
            What is it? A monthly dinner with people you have not met yet.
            Come hungry, meet someone new, and stay for the afterparty
            after dinner. Good food, good company, and a night out that
            feels like a night out. You just bring yourself.
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

        <div id="dnnr-embed" className="mb-10 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
            Save your seat
          </h2>
          <button
            data-dnnr-popup="thedinnerclub"
            className="inline-block px-6 py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800"
          >
            Book a seat
          </button>
          <p className="text-sm text-gray-500 mt-3">
            Save your seat and come meet someone new.
          </p>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
          What the night looks like
        </h2>
        <div className="space-y-4 mb-10">
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">Dinner, together</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              A good meal with neighbors you have not met yet. Bring your
              stories, try something new, and leave with a few new friends.
            </p>
          </div>
          <div className="border border-gray-200 rounded-2xl p-5">
            <p className="font-bold text-gray-900">Then the afterparty</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              When dinner wraps up, the night keeps going with the whole
              group. Stick around, keep talking, and make it a real night
              out.
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
              That saves your seat for the night. Dinner itself is
              pay-your-own at the table, so you order what you want.
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
      <Script src="https://dnnr.io/matchmaker/embed.js" strategy="afterInteractive" />
    </div>
  );
}

