"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AskView } from "@/components/AskView";
import { ReasoningView } from "@/components/ReasoningView";
import { DataView, type InsightsData } from "@/components/DataView";
import { Onboarding, ONBOARDED_KEY } from "@/components/Onboarding";
import { BoardReport } from "@/components/BoardReport";
import { ConversationExport } from "@/components/ConversationExport";
import { AskIcon, ReasonIcon, DataIcon, DroneIcon, HelpIcon, DownloadIcon } from "@/components/icons";
import { relativeTime, type ChatMessage } from "@/components/format";

type View = "ask" | "reasoning" | "data";

const VIEWS: { id: View; label: string; sub: string; Icon: typeof AskIcon }[] = [
  { id: "ask", label: "Ask", sub: "conversational BI", Icon: AskIcon },
  { id: "reasoning", label: "Reasoning", sub: "how it thinks", Icon: ReasonIcon },
  { id: "data", label: "Data & Graphs", sub: "live boards", Icon: DataIcon },
];

export default function Console() {
  const [view, setView] = useState<View>("ask");
  const [mode, setMode] = useState<"founder" | "technical">("founder");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsError, setInsightsError] = useState<string>();
  const [, setTick] = useState(0); // re-render for "synced Xs ago"
  const [tourOpen, setTourOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // First visit only: auto-open the guided tour once, then never again.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(ONBOARDED_KEY)) setTourOpen(true);
    } catch {
      // localStorage unavailable — skip the tour rather than block the app.
    }
  }, []);

  // Live insights: fetch on mount, refresh every 60s; tick relative time.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/insights");
        const json = await res.json();
        if (!alive) return;
        if (json.ok) {
          setInsights(json);
          setInsightsError(undefined);
        } else {
          setInsightsError(json.error || "unavailable");
        }
      } catch (e) {
        if (alive) setInsightsError(e instanceof Error ? e.message : "network error");
      }
    };
    load();
    const refresh = setInterval(load, 60_000);
    const ticker = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      alive = false;
      clearInterval(refresh);
      clearInterval(ticker);
    };
  }, []);

  // Cmd/Ctrl+K → jump to Ask and focus the input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setView("ask");
        setTimeout(() => inputRef.current?.focus(), 30);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = useCallback(async (text: string) => {
    // Build from a ref (not a state-updater side effect) so this fires exactly
    // once — a side effect inside setMessages double-runs under StrictMode.
    const next: ChatMessage[] = [...messagesRef.current, { role: "user", content: text }];
    setMessages(next);
    run(next);

    async function run(history: ChatMessage[]) {
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${data.error || "Request failed"}`, error: true }]);
        } else {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: data.content || "(no response)",
              toolTrace: data.toolTrace,
              model: data.model,
              confidence: data.confidence,
            },
          ]);
        }
      } catch (e) {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Network error"}`, error: true }]);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--panel)]/80 px-4 py-2.5 md:px-6">
        <div data-tour="brand" className="flex items-center gap-2.5 rounded-md">
          <span className="text-[color:var(--teal)]">
            <DroneIcon width={20} height={20} />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight text-[color:var(--ink)]">
              Skylark Survey Console
            </div>
            <div className="tick">aerial BI · live monday.com boards</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div data-tour="sync-badge">
            <SyncBadge insights={insights} error={insightsError} />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              data-tour="btn-export"
              onClick={() => setExportOpen(true)}
              title="Export conversation"
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] text-[color:var(--ink-faint)] transition-colors hover:border-[color:var(--teal)] hover:text-[color:var(--teal-deep)]"
            >
              <DownloadIcon width={14} height={14} />
            </button>
            <button
              data-tour="btn-report"
              onClick={() => setReportOpen(true)}
              title="Board report"
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] text-[color:var(--ink-faint)] transition-colors hover:border-[color:var(--teal)] hover:text-[color:var(--teal-deep)]"
            >
              <DataIcon width={14} height={14} />
            </button>
            <button
              data-tour="btn-help"
              onClick={() => setTourOpen(true)}
              title="Replay the guide"
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] text-[color:var(--ink-faint)] transition-colors hover:border-[color:var(--teal)] hover:text-[color:var(--teal-deep)]"
            >
              <HelpIcon width={14} height={14} />
            </button>
          </div>
          <div data-tour="mode-toggle">
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
        </div>
      </header>

      {/* body: rail + views */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 border-b border-[color:var(--line)] bg-[color:var(--panel)]/50 p-2 md:w-48 md:flex-col md:border-b-0 md:border-r md:p-3">
          {VIEWS.map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                data-tour={`nav-${v.id}`}
                onClick={() => setView(v.id)}
                className={`focus-ring flex flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors md:flex-none ${
                  active
                    ? "bg-[color:var(--teal)] text-white"
                    : "text-[color:var(--ink-soft)] hover:bg-[color:var(--panel-inset)]"
                }`}
              >
                <v.Icon width={17} height={17} />
                <span className="leading-tight">
                  <span className="block text-[13px] font-medium">{v.label}</span>
                  <span
                    className={`block text-[10px] ${
                      active ? "text-white/70" : "text-[color:var(--ink-faint)]"
                    }`}
                  >
                    {v.sub}
                  </span>
                </span>
              </button>
            );
          })}

          <div className="mt-auto hidden md:block">
            <div className="rounded-md border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-3 py-2">
              <div className="tick mb-1">shortcut</div>
              <div className="mono text-[11px] text-[color:var(--ink-soft)]">⌘K · jump to ask</div>
            </div>
          </div>
        </nav>

        {/* All views stay mounted so chat state + scroll survive switching. */}
        <main className="relative min-h-0 flex-1">
          <ViewPane active={view === "ask"}>
            <AskView
              ref={inputRef}
              messages={messages}
              loading={loading}
              mode={mode}
              onSend={send}
              onOpenReasoning={() => setView("reasoning")}
            />
          </ViewPane>
          <ViewPane active={view === "reasoning"}>
            <ReasoningView messages={messages} />
          </ViewPane>
          <ViewPane active={view === "data"}>
            <DataView data={insights} error={insightsError} onOpenReport={() => setReportOpen(true)} />
          </ViewPane>
        </main>
      </div>

      <Onboarding
        open={tourOpen}
        onOpenChange={setTourOpen}
        setView={setView}
        onFinish={() => {
          setView("ask");
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
      />

      {reportOpen && <BoardReport onClose={() => setReportOpen(false)} />}
      {exportOpen && <ConversationExport messages={messages} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function ViewPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={`absolute inset-0 ${active ? "" : "pointer-events-none opacity-0"}`} aria-hidden={!active}>
      {children}
    </div>
  );
}

function SyncBadge({ insights, error }: { insights: InsightsData | null; error?: string }) {
  if (error) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[color:var(--bad)]" />
        <span className="tick text-[color:var(--bad)]">offline</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5" title="Live board data refreshes periodically">
      <span className="relative flex h-2 w-2">
        <span className="ping-ring absolute inline-flex h-full w-full rounded-full bg-[color:var(--teal)]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--teal)]" />
      </span>
      <span className="tick">
        {insights ? `synced ${relativeTime(insights.syncedAt)}` : "connecting…"}
      </span>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "founder" | "technical";
  setMode: (m: "founder" | "technical") => void;
}) {
  return (
    <div className="flex rounded-md border border-[color:var(--line)] bg-[color:var(--panel-2)] p-0.5">
      {(["founder", "technical"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
            mode === m ? "bg-[color:var(--ink)] text-[color:var(--paper)]" : "text-[color:var(--ink-faint)]"
          }`}
          title={m === "founder" ? "Headline answers, caveats tucked away" : "Show tool trail, confidence basis, model"}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
