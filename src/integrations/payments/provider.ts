import type { Supabase } from "@/lib/supabase/server";
import type { Order } from "@/features/modules/domain";
export const livePayments = {
  mode: "BLOCKED" as const,
  reason:
    "No payment provider, credentials or verified webhook integration is configured. No real payment can be collected.",
};
export interface EventRegistrationProvider {
  readonly mode: "FREE_OR_DEMO";
  register(
    client: Supabase,
    input: {
      listing_id: string;
      request_key: string;
      quantity: number;
      attested: true;
      demo_attestation: boolean;
    },
  ): Promise<Order>;
}
export const eventRegistration: EventRegistrationProvider = {
  mode: "FREE_OR_DEMO",
  register(client, input) {
    return client.rpc<Order>("register_event", { input });
  },
};
