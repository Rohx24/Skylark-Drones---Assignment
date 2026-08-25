"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { RichText } from "./RichText";
import { MiniBarChart } from "./MiniBarChart";
import { CopyIcon, CheckIcon, SendIcon, ReasonIcon } from "./icons";
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
      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-6 py-10 md:px-10">
        <div className="u-column">
          {messages.length === 0 ? (
            <EmptyState onPick={submit} />
          ) : (
            <div className="space-y-9">
              {messages.map((m, i) => (
                <MessageRow
                  key={i}
                  message={m}
                  question={
                    m.role === "assistant" && messages[i - 1]?.role === "user"
                      ? messages[i - 1].content
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
      <div className="border-t border-[color:var(--line-soft)] px-6 py-4 md:px-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="u-column flex items-center gap-2.5"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about pipeline, revenue, work orders, billing…"
            disabled={loading}
            className="focus-ring flex-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-2)] px-4 py-3 text-[15px] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink-faint)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="focus-ring flex items-center gap-1.5 rounded-lg bg-[color:var(--teal)] px-4 py-3 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
          >
            <SendIcon width={16} height={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
});

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="pt-8">
      <span className="tick text-[color:var(--teal-deep)]">Survey console</span>
      <h2 className="u-h1 mt-3">Ask the survey.</h2>
      <p className="u-lead mt-3 max-w-xl">
        Natural-language questions answered from two live monday.com boards. Every figure is
        computed server-side from a real board read — never estimated by the model.
      </p>

      <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.q}
            onClick={() => onPick(s.q)}
            className="group flex flex-col items-start gap-2 rounded-lg bg-[color:var(--panel)] px-4 py-4 text-left transition-colors hover:bg-[color:var(--panel-2)]"
          >
            <span className="tick text-[color:var(--teal-deep)]">{s.tag}</span>
            <span className="text-[14.5px] leading-snug text-[color:var(--ink)]">{s.q}</span>
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
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[color:var(--ink)] px-4 py-2.5 text-[15px] leading-relaxed text-[color:var(--paper)]">
          {message.content}
        </div>
      </div>
    );
  }

  const chart = pickChart(message);

  // Assistant answers render as clean prose on the paper — no bordered box.
  // Separation between turns comes from whitespace, not chrome.
  return (
    <div>
      {message.error ? (
        <p className="u-answer text-[color:var(--bad)]">{message.content}</p>
      ) : (
        <RichText text={message.content} />
      )}

      {!message.error && chart && <MiniBarChart chart={chart} />}

      {!message.error && (
        <AnswerFooter
          message={message}
          question={question}
          mode={mode}
          onOpenReasoning={onOpenReasoning}
        />
      )}

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
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      {message.confidence && <ConfidenceTag confidence={message.confidence} mode={mode} />}

      <button
        onClick={copyBrief}
        className="u-meta flex items-center gap-1.5 transition-colors hover:text-[color:var(--teal)]"
      >
        {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
        {copied ? "Copied" : "Copy brief"}
      </button>

      {mode === "technical" && toolCount > 0 && (
        <button
          onClick={onOpenReasoning}
          className="u-meta flex items-center gap-1.5 transition-colors hover:text-[color:var(--teal)]"
        >
          <ReasonIcon width={13} height={13} />
          {toolCount} waypoint{toolCount === 1 ? "" : "s"}
        </button>
      )}

      {mode === "technical" && message.model && (
        <span className="u-meta ml-auto">{message.model}</span>
      )}
    </div>
  );
}

function ConfidenceTag({
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
        className="u-meta flex items-center gap-2"
        title={confidence.basis}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <span style={{ color }} className="font-medium">
          {confidence.level} confidence
        </span>
        <span className="mono opacity-70">{confidence.score}%</span>
      </button>

      {(open || mode === "technical") && (
        <p className="u-meta mt-1.5 max-w-md leading-relaxed">
          {confidence.basis}
        </p>
      )}
    </div>
  );
}

function Followups({ question, onPick }: { question: string; onPick: (q: string) => void }) {
  const chips = suggestFollowups(question);
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="rounded-full bg-[color:var(--panel)] px-3.5 py-1.5 text-[13px] text-[color:var(--ink-soft)] transition-colors hover:bg-[color:var(--panel-2)] hover:text-[color:var(--teal-deep)]"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[color:var(--teal)]"
            style={{ animation: `soft-bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </span>
      <span className="u-meta">Reading live boards…</span>
    </div>
  );
}
