import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "dashboard",
      "onboarding",
      "matches",
      "outreach",
      "pipeline",
      "properties",
      "talent",
      "marketplace",
      "events",
      "li3k-studio",
      "settings",
      "admin",
    ].includes(section)
  )
    notFound();
  return <Workspace section={section} />;
}
