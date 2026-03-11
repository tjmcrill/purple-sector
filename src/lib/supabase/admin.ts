import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

function createOnce() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let _client: ReturnType<typeof createOnce> | undefined;

export function createSupabaseAdminClient() {
  if (!_client) _client = createOnce();
  return _client;
}
