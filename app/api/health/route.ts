// GET /api/health — fetches BOTH boards live and reports item counts plus a
// per-issue normalization summary, so we can sanity-check the data pipeline.
// The summary logic lives in lib/quality.ts and is shared with the
// get_data_quality_summary agent tool.

import { NextResponse } from "next/server";
import { getBoards } from "@/lib/data";
import {
  summarizeDeals,
  summarizeWorkOrders,
  crossBoardOverlap,
} from "@/lib/quality";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  try {
    const { deals, workOrders } = await getBoards(true); // always live for health

    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      deals: {
        boardId: "5030843288",
        totalFetched: deals.length,
        ...summarizeDeals(deals),
      },
      workOrders: {
        boardId: "5030843478",
        totalFetched: workOrders.length,
        ...summarizeWorkOrders(workOrders),
      },
      crossBoard: crossBoardOverlap(deals, workOrders),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message, elapsedMs: Date.now() - startedAt },
      { status: 502 }
    );
  }
}
