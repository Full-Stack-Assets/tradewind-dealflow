import type { Metadata } from "next";

import { DealLabWorkspace } from "@/components/workspaces/DealLabWorkspace";

export const metadata: Metadata = { title: "Deal Lab" };

export default function DealLabPage() {
  return <DealLabWorkspace />;
}
