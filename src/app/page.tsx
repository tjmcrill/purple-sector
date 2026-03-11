import { F1Mark } from "@/components/f1-mark";
import { DuelApp } from "@/components/duel/duel-app";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex justify-center sm:mb-6">
        <F1Mark />
      </div>

      <DuelApp />
    </main>
  );
}
