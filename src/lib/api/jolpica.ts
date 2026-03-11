import "server-only";

import { env } from "@/lib/env";

export async function fetchJolpica<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const nextConfig =
    init?.cache === "no-store"
      ? init.next
      : {
          revalidate: 60 * 60,
          ...init?.next,
        };
  const response = await fetch(`${env.ergastBaseUrl}${path}`, {
    ...init,
    ...(nextConfig ? { next: nextConfig } : {}),
  });

  if (!response.ok) {
    throw new Error(`Jolpica request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
