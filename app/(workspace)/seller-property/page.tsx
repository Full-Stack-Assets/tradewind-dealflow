import type { Metadata } from "next";

import { SellerPropertyWorkspace } from "@/components/workspaces/SellerPropertyWorkspace";

export const metadata: Metadata = { title: "Seller / Property Workspace" };

export default function SellerPropertyPage() {
  return <SellerPropertyWorkspace />;
}
