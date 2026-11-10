import type { Supabase } from "@/lib/supabase/server";
import type { Delivery } from "@/features/real-estate/domain";
export interface PartnerDeliveryProvider {
  readonly mode: "DEMO" | "BLOCKED";
  deliver(
    client: Supabase,
    input: { id: string; demo_attestation: true },
  ): Promise<Delivery>;
}
// No external call: the database independently checks approval and creates a simulated receipt atomically.
export const demoPartnerDelivery: PartnerDeliveryProvider = {
  mode: "DEMO",
  deliver(client, input) {
    return client.rpc<Delivery>("simulate_partner_delivery", { input });
  },
};
export const livePartnerDelivery = {
  mode: "BLOCKED" as const,
  reason:
    "An authorized sending domain, contracted delivery provider and approved integration credentials are not configured.",
};
