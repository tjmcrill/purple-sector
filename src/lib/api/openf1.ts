import "server-only";

import { env } from "@/lib/env";

export type OpenF1WeatherSample = {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  rainfall: number;
  pressure?: number | null;
  date: string;
};

export async function fetchOpenF1<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const nextConfig =
    options?.cache === "no-store"
      ? options.next
      : {
          revalidate: 60 * 60,
          ...options?.next,
        };
  const response = await fetch(`${env.openf1BaseUrl}${path}`, {
    ...options,
    ...(nextConfig ? { next: nextConfig } : {}),
  });

  if (!response.ok) {
    throw new Error(`OpenF1 request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchSessionWeather(sessionKey: number, options?: RequestInit) {
  return fetchOpenF1<OpenF1WeatherSample[]>(
    `/weather?session_key=${sessionKey}`,
    options,
  );
}
