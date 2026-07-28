import type { Metadata } from "next";

import { ResourcesWorkspace } from "@/components/workspaces/ResourcesWorkspace";

export const metadata: Metadata = { title: "Resource Center" };

export default function ResourcesPage() {
  return <ResourcesWorkspace />;
}
