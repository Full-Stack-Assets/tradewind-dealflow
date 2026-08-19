import type { Metadata } from "next";

import { SellerPropertyWorkspace } from "@/components/workspaces/SellerPropertyWorkspace";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Seller / Property Workspace" };

export default function SellerPropertyPage() {
  return (
    <Suspense>
      <SellerPropertyWorkspace />
    </Suspense>
  );
}
