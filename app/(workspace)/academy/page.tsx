import type { Metadata } from "next";

import { AcademyWorkspace } from "@/components/workspaces/AcademyWorkspace";

export const metadata: Metadata = { title: "Academy" };

export default function AcademyPage() {
  return <AcademyWorkspace />;
}
