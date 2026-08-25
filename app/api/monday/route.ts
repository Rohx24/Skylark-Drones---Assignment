// POST /api/monday — thin passthrough to the monday GraphQL client.
//
// Body: { query: string, variables?: Record<string, unknown> }
// Server-side only so MONDAY_API_TOKEN never reaches the browser. This is the
// low-level escape hatch; the health route and (Phase 2) chat agent use the
// typed getDealsBoard()/getWorkOrdersBoard() helpers instead.

import { NextResponse } from "next/server";
import { mondayQuery } from "@/lib/monday";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { query?: unknown; variables?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.query !== "string" || body.query.trim() === "") {
    return NextResponse.json(
      { error: "Missing required 'query' string" },
      { status: 400 }
    );
  }

  const variables =
    body.variables && typeof body.variables === "object"
      ? (body.variables as Record<string, unknown>)
      : {};

  try {
    const data = await mondayQuery(body.query, variables);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
