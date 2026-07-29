import type { Metadata } from "next";

import { SourcesWorkspace } from "@/components/workspaces/SourcesWorkspace";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  return <SourcesWorkspace />;
}
