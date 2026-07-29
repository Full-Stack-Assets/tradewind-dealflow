import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "tradewind-dealflow",
      release: "massgis-ingestion",
      outreach: "disabled",
      ingestion: {
        manual: "enabled",
        scheduled: "enabled",
        ownerContactFields: "disabled",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
