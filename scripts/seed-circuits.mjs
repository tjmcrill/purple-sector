import process from "node:process";
import { pathToFileURL } from "node:url";

import { CIRCUIT_ASSET_MAP } from "./lib/current-circuit-config.mjs";
import {
  countryIdToCode,
  extractSvgPath,
  extractViewBox,
  fetchJson,
  fetchText,
  getSupabaseAdmin,
  loadEnvFile,
  parseSimpleYaml,
} from "./lib/shared.mjs";

loadEnvFile();

const baseUrl = process.env.ERGAST_BASE_URL;
if (!baseUrl) {
  throw new Error("ERGAST_BASE_URL is required");
}

function buildF1dbMetadataUrl(slug) {
  return `https://raw.githubusercontent.com/f1db/f1db/main/src/data/circuits/${slug}.yml`;
}

function buildF1dbSvgUrl(layoutId) {
  return `https://raw.githubusercontent.com/f1db/f1db/main/src/assets/circuits/black-outline/${layoutId}.svg`;
}

async function buildCircuitRow(circuit) {
  const circuitId = circuit.circuitId;
  const assetConfig = CIRCUIT_ASSET_MAP[circuitId];
  if (!assetConfig) {
    console.warn(`Skipping ${circuitId}: no SVG asset mapping configured`);
    return null;
  }

  const metadataText = await fetchText(buildF1dbMetadataUrl(assetConfig.f1dbSlug));
  const metadata = parseSimpleYaml(metadataText);
  const layouts = Array.isArray(metadata.layouts) ? metadata.layouts : [];
  const latestLayout = layouts.at(-1);
  const layoutId = latestLayout?.id;
  if (!layoutId) {
    throw new Error(`No layouts found for ${circuitId}`);
  }

  const svgText = await fetchText(buildF1dbSvgUrl(layoutId));
  const countryCode =
    countryIdToCode(metadata.countryId) ??
    (circuit.Location.country === "USA"
      ? "US"
      : circuit.Location.country.slice(0, 2).toUpperCase());

  return {
    circuit_id: circuitId,
    name: circuit.circuitName,
    country: circuit.Location.country,
    country_code: countryCode,
    svg_path: extractSvgPath(svgText),
    viewbox: extractViewBox(svgText),
    path_length: null,
    sector_markers: null,
    start_finish_t: null,
    length_km: Number(metadata.length ?? latestLayout.length ?? 0) || null,
  };
}

export async function seedCircuits({
  circuitIds,
  supabase = getSupabaseAdmin(),
} = {}) {
  let races;
  if (circuitIds?.length) {
    const payload = await fetchJson(`${baseUrl}/circuits.json?limit=100`);
    const allCircuits = payload?.MRData?.CircuitTable?.Circuits ?? [];
    races = [];
    for (const circuitId of circuitIds) {
      const circuit = allCircuits.find((entry) => entry.circuitId === circuitId);
      if (!circuit) {
        console.warn(`Skipping ${circuitId}: Jolpica circuit metadata not found`);
        continue;
      }
      races.push({ Circuit: circuit });
    }
  } else {
    const payload = await fetchJson(`${baseUrl}/current/races.json?limit=100`);
    races = payload?.MRData?.RaceTable?.Races ?? [];
  }

  const rows = [];
  for (const race of races) {
    const row = await buildCircuitRow(race.Circuit);
    if (row) {
      rows.push(row);
    }
  }

  const { error } = await supabase
    .from("circuits")
    .upsert(rows, { onConflict: "circuit_id" });

  if (error) {
    throw error;
  }

  console.log(`Seeded ${rows.length} circuits`);
}

async function main() {
  await seedCircuits();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
