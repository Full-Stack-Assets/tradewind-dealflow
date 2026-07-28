import type { Metadata } from "next";

import { PipelineWorkspace } from "@/components/workspaces/PipelineWorkspace";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return <PipelineWorkspace />;
}
