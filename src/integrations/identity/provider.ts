import type { Supabase } from "@/lib/supabase/server";
export interface IdentityProvider {
  readonly mode: "DEMO" | "BLOCKED" | "CONFIGURED" | "VERIFIED";
  start(
    client: Supabase,
  ): Promise<{ id: string; provider: "DEMO"; status: "DEMO_PASSED" }>;
}
// This adapter accepts no documents or identity photos and never represents a real verification.
export const identityProvider: IdentityProvider = {
  mode: "DEMO",
  async start(client) {
    const id = await client.rpc<string>("demo_identity");
    return { id, provider: "DEMO", status: "DEMO_PASSED" };
  },
};
