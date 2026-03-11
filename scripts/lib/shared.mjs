import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

export function loadEnvFile(filePath = path.join(rootDir, ".env.local")) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseAdmin() {
  loadEnvFile();

  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function fetchJson(url, init) {
  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(url, init);
    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryDelayMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1_000
        : Math.min(12_000, attempt * 2_000);

      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
    }

    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
}

export async function fetchText(url, init) {
  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(url, init);
    if (response.ok) {
      return response.text();
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryDelayMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1_000
        : Math.min(12_000, attempt * 2_000);

      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
    }

    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
}

export function parseLapTimeToMs(value) {
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

export function formatLapTime(ms) {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const millis = ms % 1_000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function normalizeDriverName(name) {
  return name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

export function extractSvgPath(svgText) {
  const matches = [...svgText.matchAll(/<path\b[^>]*d="([^"]+)"/g)];
  if (matches.length === 0) {
    throw new Error("No <path> element found in SVG");
  }

  return matches[0][1];
}

export function extractViewBox(svgText) {
  const viewBoxMatch = svgText.match(/\bviewBox="([^"]+)"/i);
  if (viewBoxMatch) {
    return viewBoxMatch[1];
  }

  const widthMatch = svgText.match(/\bwidth="([^"]+)"/i);
  const heightMatch = svgText.match(/\bheight="([^"]+)"/i);
  if (!widthMatch || !heightMatch) {
    throw new Error("SVG is missing viewBox and width/height");
  }

  const width = Number.parseFloat(widthMatch[1]);
  const height = Number.parseFloat(heightMatch[1]);
  return `0 0 ${width} ${height}`;
}

export function parseSimpleYaml(yamlText) {
  const document = {};
  let currentArrayKey = null;

  for (const rawLine of yamlText.split("\n")) {
    const line = rawLine.replace(/\r/g, "");
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    if (/^\S[^:]+:\s*$/.test(line)) {
      const key = line.split(":")[0].trim();
      document[key] = [];
      currentArrayKey = key;
      continue;
    }

    const arrayItemMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayItemMatch && currentArrayKey) {
      const item = {};
      const itemContent = arrayItemMatch[1];
      const inlineKeyMatch = itemContent.match(/^([^:#]+):\s*(.+?)\s*(?:#.*)?$/);
      if (inlineKeyMatch) {
        item[inlineKeyMatch[1].trim()] = inlineKeyMatch[2].trim();
      } else {
        document[currentArrayKey].push(itemContent.trim());
        continue;
      }

      document[currentArrayKey].push(item);
      continue;
    }

    const nestedKeyMatch = line.match(/^\s+([^:#]+):\s*(.+?)\s*(?:#.*)?$/);
    if (nestedKeyMatch && currentArrayKey && Array.isArray(document[currentArrayKey])) {
      const lastItem = document[currentArrayKey][document[currentArrayKey].length - 1];
      if (lastItem && typeof lastItem === "object" && !Array.isArray(lastItem)) {
        lastItem[nestedKeyMatch[1].trim()] = nestedKeyMatch[2].trim();
      }
      continue;
    }

    const keyValueMatch = line.match(/^([^:#]+):\s*(.+?)\s*(?:#.*)?$/);
    if (keyValueMatch) {
      document[keyValueMatch[1].trim()] = keyValueMatch[2].trim();
      currentArrayKey = null;
    }
  }

  return document;
}

export function countryIdToCode(countryId) {
  const map = {
    australia: "AU",
    austria: "AT",
    azerbaijan: "AZ",
    bahrain: "BH",
    belgium: "BE",
    brazil: "BR",
    canada: "CA",
    china: "CN",
    hungary: "HU",
    italy: "IT",
    japan: "JP",
    monaco: "MC",
    netherlands: "NL",
    qatar: "QA",
    "saudi-arabia": "SA",
    singapore: "SG",
    spain: "ES",
    "united-arab-emirates": "AE",
    "united-kingdom": "GB",
    "united-states": "US",
  };

  return map[countryId] ?? null;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
