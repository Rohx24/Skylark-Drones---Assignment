// POST /api/chat — runs the BI agent for a conversation.
// Body: { messages: { role: "user" | "assistant", content: string }[] }
// Returns: { content, toolTrace, model }

import { NextResponse } from "next/server";
import { runAgent, type IncomingMessage } from "@/lib/agent";
import { getBoardStatuses, computeConfidence } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "Body must include a 'messages' array" },
      { status: 400 }
    );
  }

  // Sanitize to the shape the agent expects.
  const history: IncomingMessage[] = [];
  for (const m of body.messages) {
    if (
      m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
    ) {
      history.push({ role: m.role, content: m.content });
    }
  }

  if (history.length === 0) {
    return NextResponse.json(
      { error: "No valid messages provided" },
      { status: 400 }
    );
  }

  try {
    const result = await runAgent(history);
    // Additive: a real, field-completeness-based confidence for this answer,
    // derived from the board(s) the tools actually read. Null for tool-less
    // answers (e.g. clarifying questions). Agent logic is untouched.
    let confidence = null;
    try {
      const { statuses } = await getBoardStatuses();
      confidence = computeConfidence(
        result.toolTrace.map((t) => t.name),
        statuses
      );
    } catch {
      confidence = null; // never fail the answer over the confidence add-on
    }
    return NextResponse.json({ ...result, confidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
