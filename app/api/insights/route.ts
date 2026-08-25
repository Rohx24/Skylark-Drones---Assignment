// GET /api/insights — live board status, completeness, and chart datasets for
// the Data & Graphs view. Reads through lib/insights.ts, which uses the same
// getBoards()/tool layer as the agent. No sample data.

import { NextResponse } from "next/server";
import { getInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getInsights();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
