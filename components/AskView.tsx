"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { RichText } from "./RichText";
import { MiniBarChart } from "./MiniBarChart";
import { CopyIcon, CheckIcon, SendIcon, DroneIcon, ReasonIcon } from "./icons";
import { buildBrief, type ChartSeries, type ChatMessage, type Confidence } from "./format";

const STARTERS = [
  { tag: "Pipeline", q: "How's the mining pipeline shaping up right now?" },
  { tag: "Revenue", q: "Which sector has billed the most this year, ex-GST?" },
  { tag: "Cross-board", q: "Which won deals don't have a work order yet?" },
  { tag: "Leadership", q: "Give me a leadership update on the Renewables sector." },
];

/** The answer's chartable series, if any: the richest grouped tool result. */
function pickChart(message: ChatMessage): ChartSeries | undefined {
  const withChart = (message.toolTrace ?? [])
    .map((t) => t.chart)
    .filter((c): c is ChartSeries => !!c && c.points.length >= 3);
  if (withChart.length === 0) return undefined;
  return withChart.sort((a, b) => b.points.length - a.points.length)[0];
}

function suggestFollowups(question: string): string[] {
  const q = question.toLowerCase();
  if (/pipeline|stage|lead|deal/.test(q))
    return ["Break it down by owner", "Which are in negotiation?", "Value sitting on hold?"];
  if (/revenue|billed|gst|amount|money/.test(q))
    return ["Same figure including GST?", "Split by sector", "How much is still receivable?"];
  if (/billing|invoice|collect|receivable/.test(q))
    return ["Which are Not Billable?", "Open vs closed work orders", "Show the AR-priority ones"];
  if (/convert|work order|cross|linked/.test(q))
    return ["List the high-value unconverted", "Only Won-stage deals", "Which sectors lag most?"];
  if (/update|summary|brief|leadership|overview/.test(q))
    return ["Now just for Mining", "Add the billing picture", "What are the key risks?"];
  return ["Break this down by sector", "Add the data-quality caveat", "Show the underlying records"];
}

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  mode: "founder" | "technical";
  onSend: (text: string) => void;
  onOpenReasoning: () => void;
}

export const AskView = forwardRef<HTMLInputElement, Props>(function AskView(
  { messages, loading, mode, onSend, onOpenReasoning },
  inputRef
) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    onSend(t);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-5 py-6 md:px-8">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <EmptyState onPick={submit} />
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageRow
                  key={i}
                  message={m}
                  question={
                    m.role === "assistant"
                      ? messages[i - 1]?.role === "user"
                        ? messages[i - 1].content
                        : ""
                      : ""
                  }
                  mode={mode}
                  isLastAssistant={m.role === "assistant" && i === messages.length - 1}
                  onOpenReasoning={onOpenReasoning}
                  onFollowup={submit}
                />
              ))}
              {loading && <ThinkingRow />}
            </div>
          )}
        </div>
      </div>

      {/* input dock */}
      <div className="border-t border-[color:var(--line)] bg-[color:var(--panel)]/70 px-5 py-3.5 md:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="mx-auto flex max-w-3xl items-center gap-2.5"
        >
          <div className="tick shrink-0 rounded-sm border border-[color:var(--line)] px-1.5 py-1">
            ⌘K
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about pipeline, revenue, work orders, billing…"
            disabled={loading}
            className="focus-ring flex-1 rounded-md border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3.5 py-2.5 text-[13.5px] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink-faint)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="focus-ring flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-3.5 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
          >
            <SendIcon width={15} height={15} /> Send
          </button>
        </form>
      </div>
    </div>
  );
});

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="pt-6">
      <div className="mb-1 flex items-center gap-2 text-[color:var(--teal)]">
        <DroneIcon width={20} height={20} />
        <span className="tick text-[color:var(--teal-deep)]">Survey console · ready</span>
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--ink)]">
        Ask the survey.
      </h2>
      <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]">
        Natural-language questions answered from two live monday.com boards. Every figure is
        computed server-side from a real board read — never estimated by the model.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.q}
            onClick={() => onPick(s.q)}
            className="panel corner-ticks group flex flex-col items-start gap-1.5 px-4 py-3.5 text-left transition-colors hover:border-[color:var(--teal)]"
          >
            <span className="tick text-[color:var(--teal-deep)]">{s.tag}</span>
            <span className="text-[13px] text-[color:var(--ink)] group-hover:text-[color:var(--teal-deep)]">
              {s.q}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  question,
  mode,
  isLastAssistant,
  onOpenReasoning,
  onFollowup,
}: {
  message: ChatMessage;
  question: string;
  mode: "founder" | "technical";
  isLastAssistant: boolean;
  onOpenReasoning: () => void;
  onFollowup: (q: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-[color:var(--ink)] px-3.5 py-2 text-[13.5px] leading-relaxed text-[color:var(--paper)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`panel corner-ticks panel-2 px-4 py-3.5 ${
          message.error ? "border-[color:var(--bad)]" : ""
        }`}
      >
        {message.error ? (
          <p className="text-[13px] text-[color:var(--bad)]">{message.content}</p>
        ) : (
          <RichText text={message.content} />
        )}

        {!message.error && pickChart(message) && <MiniBarChart chart={pickChart(message)!} />}

        {!message.error && (
          <AnswerFooter
            message={message}
            question={question}
            mode={mode}
            onOpenReasoning={onOpenReasoning}
          />
        )}
      </div>

      {isLastAssistant && !message.error && (
        <Followups question={question} onPick={onFollowup} />
      )}
    </div>
  );
}

function AnswerFooter({
  message,
  question,
  mode,
  onOpenReasoning,
}: {
  message: ChatMessage;
  question: string;
  mode: "founder" | "technical";
  onOpenReasoning: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toolCount = message.toolTrace?.length ?? 0;

  async function copyBrief() {
    await navigator.clipboard.writeText(buildBrief(question, message.content, message.confidence));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--line-soft)] pt-2.5">
      {message.confidence && <ConfidenceMeter confidence={message.confidence} mode={mode} />}

      <button
        onClick={copyBrief}
        className="tick flex items-center gap-1.5 hover:text-[color:var(--teal)]"
      >
        {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
        {copied ? "Copied" : "Copy for leadership brief"}
      </button>

      {mode === "technical" && toolCount > 0 && (
        <button
          onClick={onOpenReasoning}
          className="tick flex items-center gap-1.5 hover:text-[color:var(--teal)]"
        >
          <ReasonIcon width={13} height={13} />
          {toolCount} waypoint{toolCount === 1 ? "" : "s"} · view flight path
        </button>
      )}

      {mode === "technical" && message.model && (
        <span className="tick ml-auto">{message.model}</span>
      )}
    </div>
  );
}

function ConfidenceMeter({
  confidence,
  mode,
}: {
  confidence: Confidence;
  mode: "founder" | "technical";
}) {
  const [open, setOpen] = useState(false);
  const color =
    confidence.level === "High"
      ? "var(--ok)"
      : confidence.level === "Moderate"
      ? "var(--warn)"
      : "var(--bad)";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2"
        title="Data completeness of the board(s) this answer read"
      >
        <span className="tick">Data conf.</span>
        <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--panel-inset)]">
          <span
            className="h-full rounded-full"
            style={{ width: `${confidence.score}%`, background: color }}
          />
        </span>
        <span className="mono text-[11px] font-semibold" style={{ color }}>
          {confidence.level} · {confidence.score}%
        </span>
      </button>

      {(open || mode === "technical") && (
        <div className="mt-1.5 max-w-md rounded border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-2.5 py-2">
          <p className="text-[11px] leading-relaxed text-[color:var(--ink-soft)]">{confidence.basis}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {confidence.boards.map((b) => (
              <span key={b.title} className="mono text-[10.5px] text-[color:var(--ink-faint)]">
                {b.title}: {b.completeness}% complete
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Followups({ question, onPick }: { question: string; onPick: (q: string) => void }) {
  const chips = suggestFollowups(question);
  return (
    <div className="flex flex-wrap items-center gap-2 pl-1">
      <span className="tick">Go deeper</span>
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-1 text-[12px] text-[color:var(--ink-soft)] transition-colors hover:border-[color:var(--teal)] hover:text-[color:var(--teal-deep)]"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="panel corner-ticks panel-2 flex items-center gap-3 px-4 py-3.5">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[color:var(--teal)]"
            style={{ animation: `soft-bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </span>
      <span className="tick">Plotting waypoints · reading live boards…</span>
    </div>
  );
}
