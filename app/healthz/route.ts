import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "tradewind-dealflow",
      release: "local-first",
      outreach: "disabled",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
