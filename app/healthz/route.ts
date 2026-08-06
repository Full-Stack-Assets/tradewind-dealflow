import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "tradewind-dealflow",
      release: "acquisitions-os",
      outreach: "disabled",
      ingestion: {
        manual: "disabled",
        scheduled: "enabled",
        ownerContactFields: "disabled",
        leadAutomation: "available",
        ownerEnrichment: "disabled",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
