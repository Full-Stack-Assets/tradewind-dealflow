import type { Metadata } from "next";

import { DashboardWorkspace } from "@/components/workspaces/DashboardWorkspace";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
