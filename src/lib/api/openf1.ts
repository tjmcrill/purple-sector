import "server-only";

import { env } from "@/lib/env";

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
