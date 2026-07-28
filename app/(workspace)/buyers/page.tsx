import type { Metadata } from "next";

import { BuyersWorkspace } from "@/components/workspaces/BuyersWorkspace";

export const metadata: Metadata = { title: "Buyers" };

export default function BuyersPage() {
  return <BuyersWorkspace />;
}
