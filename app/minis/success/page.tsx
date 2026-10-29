import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default function MiniSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">You're in!</h1>
        <p className="text-gray-600 text-sm">
          Your guide purchase went through. We&apos;ve emailed you a personal link to open it. (Check spam if you don&apos;t see it in a minute or two.)
        </p>
      </div>
      </div>
    </div>
  );
}
