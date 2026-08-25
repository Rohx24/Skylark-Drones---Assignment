// GET /api/report — the printable board report. Reads through the same
// getBoards() cache as everything else; pass ?refresh=1 to force a live
// re-fetch instead of serving the 60s cache.

import { NextResponse } from "next/server";
import { getBoardReport } from "@/lib/report";
import { getBoards } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("refresh") === "1") {
      await getBoards(true);
    }
    const data = await getBoardReport();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
