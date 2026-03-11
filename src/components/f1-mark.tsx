import Image from "next/image";

export function F1Mark({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src="/f1-logo.png"
        alt="Formula 1"
        width={120}
        height={30}
        className="h-8 w-auto sm:h-10"
        priority
      />
      <span className="text-xs font-semibold uppercase tracking-[0.34em] text-[#888888] sm:text-sm">
        Lap Time Duel
      </span>
    </div>
  );
}
