import Link from "next/link";
import Logo from "@/components/Logo";

interface Game {
  name: string;
  description: string;
  href: string;
  icon: JSX.Element;
}

const games: Game[] = [
  {
    name: "The Decatur Wordy",
    description: "Daily 5-letter word puzzle · all answers Decatur area",
    href: "/wordy",
    icon: (
      <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
];

export default function GamesPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 py-3">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/"><Logo className="h-10 w-auto" /></Link>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">Games</p>
            <p className="text-xs text-gray-400">Play something new every day</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
          The Gist Games
        </p>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">
          Pick a game
        </h1>

        <div className="grid sm:grid-cols-3 gap-4">
          {games.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className="group block rounded-2xl border border-gray-100 bg-gray-50 hover:border-green-200 hover:bg-green-50 transition-colors p-6"
            >
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                {game.icon}
              </div>
              <p className="font-semibold text-gray-900 leading-snug group-hover:text-green-800 transition-colors">
                {game.name}
              </p>
              <p className="text-sm text-gray-500 mt-2">{game.description}</p>
              <p className="text-sm text-green-700 font-medium mt-3">
                Play now →
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
