export type StudioProvider = {
  status: "BLOCKED" | "DEMO" | "CONFIGURED" | "VERIFIED";
  capability: string;
  reason: string;
};
export const studioProviders: Record<string, StudioProvider> = {
  preparation: {
    status: "DEMO",
    capability: "Deterministic text and storyboard preparation",
    reason: "Templates only; no AI request, image or video generation.",
  },
  text: {
    status: "BLOCKED",
    capability: "AI audience and copy recommendations",
    reason:
      "Provider, credentials, spending limits and acceptance not configured.",
  },
  media: {
    status: "BLOCKED",
    capability: "Image and video generation",
    reason: "API contract, private storage and verified delivery required.",
  },
  publishing: {
    status: "BLOCKED",
    capability: "Live social publication",
    reason:
      "Official app permissions, authorized accounts and provider verification required. Use reviewed manual export.",
  },
  analytics: {
    status: "BLOCKED",
    capability: "Provider analytics",
    reason:
      "No live source connected. Reports are manually entered, aggregate and unverified.",
  },
};
