"use client";

import { WaypointTrail } from "./WaypointTrail";
import { LayersIcon, ReasonIcon, ChevronIcon } from "./icons";
import { lastTracedAnswer, type ChatMessage } from "./format";

// The real pipeline, described as-built (verified against the code):
// browser chat → /api/chat → runAgent (OpenAI tool-calling) → lib/tools.ts
// (all aggregation) → lib/data.ts cache → lib/monday.ts → monday GraphQL.
const STAGES = [
  { code: "UI", label: "Chat console", detail: "Browser sends the message history to the server. No keys or data layer in the client." },
  { code: "AGT", label: "Agent route", detail: "/api/chat → runAgent(): OpenAI chat-completions with function-calling picks which tools to run and with what filters." },
  { code: "TL", label: "Tool layer", detail: "lib/tools.ts runs the query in plain TypeScript and does ALL counting/summing. The model never computes a figure." },
  { code: "DL", label: "Data layer", detail: "lib/data.ts serves parsed, normalized records from a 60s cache so one turn = one live read." },
  { code: "SRC", label: "monday.com", detail: "lib/monday.ts paginates the two boards over the GraphQL API — the live source of truth." },
];

export function ReasoningView({ messages }: { messages: ChatMessage[] }) {
  const traced = lastTracedAnswer(messages);
  const trace = traced?.message.toolTrace ?? [];
  const liveReads = trace.filter((t) => t.name.startsWith("query_") || t.name === "cross_board_lookup").length;

  return (
    <div className="scroll-thin h-full overflow-y-auto px-5 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* flight path for the latest answer */}
        <section className="panel corner-ticks px-5 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--teal-soft)] text-[color:var(--teal-deep)]">
                <ReasonIcon width={16} height={16} />
              </span>
              <div>
                <span className="tick text-[color:var(--teal-deep)]">Flight path · latest answer</span>
                <h3 className="mt-0.5 text-[15px] font-semibold text-[color:var(--ink)]">Tool waypoints</h3>
              </div>
            </div>
            {traced && (
              <div className="flex shrink-0 items-center gap-3 pt-0.5">
                <StatChip value={trace.length} label={trace.length === 1 ? "waypoint" : "waypoints"} />
                <StatChip value={liveReads} label="live reads" />
                {traced.message.model && <span className="tick">{traced.message.model}</span>}
              </div>
            )}
          </div>

          {traced?.question && (
            <p className="mb-4 rounded border-l-2 border-[color:var(--teal)] bg-[color:var(--panel-inset)] px-3 py-2 text-[12.5px] italic text-[color:var(--ink-soft)]">
              “{traced.question}”
            </p>
          )}

          {traced ? (
            <WaypointTrail trace={trace} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-[color:var(--ink-faint)]">
                <ReasonIcon width={22} height={22} />
              </span>
              <p className="tick max-w-xs">
                No tool-backed answer yet — ask something in the Ask view and its flight path appears here.
              </p>
            </div>
          )}
        </section>

        {/* permanent architecture explainer — collapsible so repeat visits stay uncluttered */}
        <details className="panel corner-ticks px-5 py-4" open>
          <summary className="mb-1 flex cursor-pointer select-none items-center gap-2 text-[color:var(--teal)]">
            <ChevronIcon width={12} height={12} className="chevron shrink-0" />
            <LayersIcon width={17} height={17} />
            <span className="tick text-[color:var(--teal-deep)]">Architecture · how it thinks</span>
          </summary>
          <p className="mb-4 mt-3 max-w-2xl text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
            Every answer travels the same five legs. The split that matters:{" "}
            <strong className="font-semibold text-[color:var(--ink)]">
              the model chooses the tools; the server computes the numbers.
            </strong>{" "}
            Figures are summed in TypeScript and copied verbatim into the answer, so a number can be
            wrong-source but never invented.
          </p>

          <ol className="space-y-0">
            {STAGES.map((s, i) => (
              <li key={s.code} className="flex gap-3.5 pb-4 last:pb-0">
                <div className="relative flex w-10 flex-col items-center">
                  <span className="mono z-10 flex h-7 w-10 items-center justify-center rounded-sm border border-[color:var(--teal)] bg-[color:var(--panel-inset)] text-[10px] font-semibold tracking-wider text-[color:var(--teal-deep)]">
                    {s.code}
                  </span>
                  {i !== STAGES.length - 1 && (
                    <span className="mt-1 w-px flex-1 border-l border-dashed border-[color:var(--teal)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="text-[13px] font-semibold text-[color:var(--ink)]">{s.label}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
                    {s.detail}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="mono text-[13px] font-semibold text-[color:var(--ink)]">{value}</span>
      <span className="tick">{label}</span>
    </span>
  );
}
