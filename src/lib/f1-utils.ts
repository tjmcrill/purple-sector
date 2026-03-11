export function formatLapTime(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const millis = ms % 1_000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function parseLapTimeToMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(?:(\d+):)?(\d{1,2})\.(\d{3})$/);
  if (!match) {
    return null;
  }

  const [, minutes = "0", seconds, millis] = match;
  return Number(minutes) * 60_000 + Number(seconds) * 1_000 + Number(millis);
}

export function normalizeDriverName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

export function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(char.charCodeAt(0) + 127397),
    );
}

const NATIONALITY_TO_CODE: Record<string, string> = {
  Dutch: "NL",
  British: "GB",
  Monegasque: "MC",
  Mexican: "MX",
  Spanish: "ES",
  Australian: "AU",
  German: "DE",
  French: "FR",
  Finnish: "FI",
  Japanese: "JP",
  Canadian: "CA",
  Thai: "TH",
  Chinese: "CN",
  Danish: "DK",
  American: "US",
  "New Zealander": "NZ",
  Italian: "IT",
  Swiss: "CH",
  Polish: "PL",
  Brazilian: "BR",
  Argentine: "AR",
};

export function nationalityToCode(nationality: string): string | null {
  return NATIONALITY_TO_CODE[nationality] ?? null;
}

export function driverFlag(nationality: string | null): string {
  if (!nationality) return "";
  const code = nationalityToCode(nationality);
  return code ? flagEmoji(code) : "";
}
