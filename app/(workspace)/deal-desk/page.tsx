import type { Metadata } from "next";

import { DealDeskWorkspace } from "@/components/workspaces/DealDeskWorkspace";

export const metadata: Metadata = { title: "Deal Desk" };

export default function DealDeskPage() {
  return <DealDeskWorkspace />;
}
