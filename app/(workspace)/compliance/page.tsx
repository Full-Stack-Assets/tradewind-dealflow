import type { Metadata } from "next";

import { ComplianceWorkspace } from "@/components/workspaces/ComplianceWorkspace";

export const metadata: Metadata = { title: "Compliance" };

export default function CompliancePage() {
  return <ComplianceWorkspace />;
}
