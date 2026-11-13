import type { Metadata } from "next";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import EventsSubscribe from "@/components/EventsSubscribe";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ws = await getWorkspace();
  return {
    title: `Dinner Club | ${ws.name}`,
    description: `A one-night dinner in ${ws.area} for meeting new people over a good meal, with an afterparty after. Thursday, December 10, 2026 at 6 PM.`,
  };
}

// Public dinner club page for this workspace: a one-night dinner
// for meeting new people and having fun. Dinner together, then an
// afterparty with the whole group. The "Book a seat" button links
// directly to the DNNR community page. The night is
// Thursday, December 10, 2026 at 6 PM.
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
            Fill out a quick questionnaire, and we&apos;ll match you with
            five like-minded people for dinner at a mystery restaurant.
            No awkward introductions, no pressure. Just a chance to meet
            new people, make real connections, and have a great night.
          </p>
          <div className="inline-block mt-6 bg-green-50 border border-green-100 rounded-2xl px-5 py-5 text-center">
            <Image
              src="/the-gist-dinner-club.png"
              alt="The Dinner Club: meet new people, make new connections, have fun! Thursday, December 10 at 6 PM, secret afterparty starts at 8 PM."
              width={4317}
              height={4317}
              className="w-full max-w-[320px] h-auto rounded-xl mx-auto"
            />
            <p className="text-xs font-bold tracking-widest text-green-700 mt-4">
              One-of-a-kind Event
            </p>
            <p className="font-bold text-gray-900 mt-1">
              Thursday, December 10, 2026 at 6 PM
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Meet new people, make new connections, have fun!
            </p>
          </div>
        </div>

        <div className="mb-10 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
            Save your seat
          </h2>
          <a
            href="https://thedinnerclub.dnnr.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800"
          >
            Book a seat
          </a>
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
