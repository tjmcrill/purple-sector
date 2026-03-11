function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  ergastBaseUrl: required("ERGAST_BASE_URL"),
  openf1BaseUrl: required("OPENF1_BASE_URL"),
  cronSecret: optional("CRON_SECRET"),
};
