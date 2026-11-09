import { supabaseConfig } from "./env.mjs";
export async function checkSupabase(
  environment = process.env,
  request = fetch,
) {
  const config = supabaseConfig(environment);
  try {
    const response = await request(config.url + "/auth/v1/settings", {
      method: "GET",
      headers: { apikey: config.publishableKey },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Provider rejected the check.");
  } catch {
    throw new Error(
      "Supabase API check failed. Check project availability, URL, publishable key and network access.",
    );
  }
}
