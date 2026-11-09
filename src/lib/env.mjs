export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function supabaseConfig(environment = process.env) {
  const value = environment.SUPABASE_URL;
  const key = environment.SUPABASE_PUBLISHABLE_KEY;
  if (!value || !key)
    throw new ConfigurationError(
      "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the deployment environment.",
    );
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError("SUPABASE_URL must be a valid project URL.");
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
    throw new ConfigurationError(
      "Use an HTTPS Supabase project origin, or HTTP localhost for local development.",
    );
  }
  if (
    !key.startsWith("sb_publishable_") ||
    key.length <= "sb_publishable_".length ||
    /\s/.test(key)
  ) {
    throw new ConfigurationError(
      "Use a Supabase publishable key; secret and legacy service-role keys are not accepted.",
    );
  }
  return { url: url.origin, publishableKey: key };
}

export function applicationOrigin(requestOrigin, environment = process.env) {
  if (!environment.APP_BASE_URL) return requestOrigin;
  let url;
  try {
    url = new URL(environment.APP_BASE_URL);
  } catch {
    throw new ConfigurationError(
      "APP_BASE_URL must be your valid HTTPS site origin.",
    );
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
    throw new ConfigurationError(
      "APP_BASE_URL must be your HTTPS site origin without credentials, paths or query strings.",
    );
  }
  return url.origin;
}
