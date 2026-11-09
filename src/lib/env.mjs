export function supabaseConfig(environment = process.env) {
  const value = environment.SUPABASE_URL;
  const key = environment.SUPABASE_PUBLISHABLE_KEY;
  if (!value || !key)
    throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL must be a valid project URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "Use an HTTPS Supabase project origin, or HTTP localhost for local development.",
    );
  }
  if (
    !key.startsWith("sb_publishable_") ||
    key.length <= "sb_publishable_".length ||
    /\s/.test(key)
  ) {
    throw new Error(
      "Use a Supabase publishable key; secret and legacy service-role keys are not accepted.",
    );
  }
  return { url: url.origin, publishableKey: key };
}
