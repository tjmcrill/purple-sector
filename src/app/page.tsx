import Link from "next/link";

import { F1Mark } from "@/components/f1-mark";
import { DuelApp } from "@/components/duel/duel-app";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <F1Mark />
        <Link
          href="/teammates"
          className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#cfcfcf] transition hover:border-[#3d3d3d] hover:bg-[#171717]"
        >
          Teammate Battles
        </Link>
      </div>

      <DuelApp />
    </main>
  );
}
