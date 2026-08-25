"use client";

// Exports the current Ask session: a deterministic summary computed from the
// real message history (question/answer counts, boards touched, average
// confidence — nothing inferred by a model), the full transcript below it,
// a JSON download of the raw messages, and Print/Save as PDF via the same
// .printable-root mechanism the board report uses.
import { useMemo } from "react";
import { RichText } from "./RichText";
import { CloseIcon, DownloadIcon, ReasonIcon } from "./icons";
import type { ChatMessage, Confidence } from "./format";

interface Summary {
  questionCount: number;
  answerCount: number;
  totalWaypoints: number;
  boardsTouched: string[];
  avgConfidence: number | null;
}

function buildSummary(messages: ChatMessage[]): Summary {
  const questions = messages.filter((m) => m.role === "user");
  const answers = messages.filter((m) => m.role === "assistant" && !m.error);
  let totalWaypoints = 0;
  const boards = new Set<string>();

  for (const m of answers) {
    for (const t of m.toolTrace ?? []) {
      totalWaypoints += 1;
      if (t.name === "query_deals") boards.add("Deals");
      if (t.name === "query_work_orders") boards.add("Work Orders");
      if (t.name === "cross_board_lookup") {
        boards.add("Deals");
        boards.add("Work Orders");
      }
    }
  }

  const confidences = answers.map((m) => m.confidence).filter((c): c is Confidence => !!c);
  const avgConfidence =
    confidences.length === 0
      ? null
      : Math.round(confidences.reduce((a, c) => a + c.score, 0) / confidences.length);

  return {
    questionCount: questions.length,
    answerCount: answers.length,
    totalWaypoints,
    boardsTouched: Array.from(boards),
    avgConfidence,
  };
}

function downloadJson(messages: ChatMessage[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "Skylark Survey Console",
    messages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `skylark-conversation-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ConversationExport({ messages, onClose }: { messages: ChatMessage[]; onClose: () => void }) {
  const summary = useMemo(() => buildSummary(messages), [messages]);
  const generatedAt = useMemo(() => new Date(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/45 p-4 backdrop-blur-[2px]">
      <div className="printable-root panel corner-ticks flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-[color:var(--line-soft)] px-5 py-4 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--teal-soft)] text-[color:var(--teal-deep)]">
              <DownloadIcon width={16} height={16} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-[color:var(--ink)]">Export conversation</div>
              <div className="tick">summary + full history for this session</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadJson(messages)}
              disabled={messages.length === 0}
              className="focus-ring rounded-md border border-[color:var(--line)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--ink-soft)] transition-colors hover:border-[color:var(--teal)] hover:text-[color:var(--teal-deep)] disabled:opacity-50"
            >
              Download JSON
            </button>
            <button
              onClick={() => window.print()}
              disabled={messages.length === 0}
              className="focus-ring rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-faint)] transition-colors hover:bg-[color:var(--panel-inset)] hover:text-[color:var(--ink)]"
              title="Close"
            >
              <CloseIcon width={15} height={15} />
            </button>
          </div>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-[color:var(--ink-faint)]">
                <DownloadIcon width={22} height={22} />
              </span>
              <p className="tick max-w-xs">
                Nothing to export yet — ask something in the Ask view first.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              <p className="tick">
                Skylark Survey Console · generated {generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>

              {/* deterministic session summary — every figure counted from the real messages */}
              <section>
                <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">Session summary</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile label="Questions asked" value={String(summary.questionCount)} />
                  <SummaryTile label="Answers given" value={String(summary.answerCount)} />
                  <SummaryTile label="Tool waypoints" value={String(summary.totalWaypoints)} />
                  <SummaryTile
                    label="Avg. confidence"
                    value={summary.avgConfidence != null ? `${summary.avgConfidence}%` : "—"}
                    accent
                  />
                </div>
                {summary.boardsTouched.length > 0 && (
                  <p className="tick mt-3">boards read: {summary.boardsTouched.join(" + ")}</p>
                )}
              </section>

              {/* full transcript */}
              <section>
                <h3 className="mb-3 text-[14px] font-semibold text-[color:var(--ink)]">Conversation history</h3>
                <div className="space-y-6">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="rounded-md bg-[color:var(--panel-inset)] px-3.5 py-2.5">
                        <span className="tick">Q{Math.floor(i / 2) + 1}</span>
                        <p className="mt-1 text-[13.5px] text-[color:var(--ink)]">{m.content}</p>
                      </div>
                    ) : (
                      <div key={i} className="pl-1">
                        {m.error ? (
                          <p className="u-body text-[color:var(--bad)]">{m.content}</p>
                        ) : (
                          <RichText text={m.content} />
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {m.confidence && (
                            <span className="tick">
                              {m.confidence.level} confidence · {m.confidence.score}%
                            </span>
                          )}
                          {(m.toolTrace?.length ?? 0) > 0 && (
                            <span className="tick flex items-center gap-1">
                              <ReasonIcon width={11} height={11} />
                              {m.toolTrace!.length} waypoint{m.toolTrace!.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>

              <p className="tick border-t border-[color:var(--line-soft)] pt-4">
                Every answer above was computed from a live read of the monday.com Deals and Work
                Orders boards. Masked values.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-3.5 py-3">
      <div className="tick">{label}</div>
      <div className={`mono mt-1 text-[19px] font-semibold ${accent ? "text-[color:var(--teal-deep)]" : "text-[color:var(--ink)]"}`}>
        {value}
      </div>
    </div>
  );
}
