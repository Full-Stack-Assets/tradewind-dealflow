import type { Metadata } from "next";

import { ApprovalQueueWorkspace } from "@/components/workspaces/ApprovalQueueWorkspace";

export const metadata: Metadata = { title: "Approval Queue" };

export default function ApprovalsPage() {
  return <ApprovalQueueWorkspace />;
}
