export const TEAM_COLORS: Record<
  string,
  { primary: string; secondary: string }
> = {
  Mercedes: { primary: "#00D2BE", secondary: "#FFFFFF" },
  "Red Bull": { primary: "#3671C6", secondary: "#FFD700" },
  Ferrari: { primary: "#E8002D", secondary: "#FFFFFF" },
  McLaren: { primary: "#FF8000", secondary: "#111111" },
  "Aston Martin": { primary: "#229971", secondary: "#FFFFFF" },
  Alpine: { primary: "#FF69B4", secondary: "#0090FF" },
  Williams: { primary: "#64C4FF", secondary: "#FFFFFF" },
  RB: { primary: "#6692FF", secondary: "#FF0000" },
  "Kick Sauber": { primary: "#52E252", secondary: "#111111" },
  Haas: { primary: "#E8002D", secondary: "#FFFFFF" },
  Cadillac: { primary: "#CC0000", secondary: "#FFFFFF" },
  "Racing Bulls": { primary: "#6692FF", secondary: "#FF0000" },
  Sauber: { primary: "#52E252", secondary: "#111111" },
  "Alfa Romeo": { primary: "#8B0000", secondary: "#FFFFFF" },
  Renault: { primary: "#FFF500", secondary: "#111111" },
};

export function getTeamColors(team: string) {
  return TEAM_COLORS[team] ?? {
    primary: "#f5f5f5",
    secondary: "#0f0f0f",
  };
}
