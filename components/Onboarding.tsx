"use client";

// First-time-only guided tour — a moving spotlight, not a blocking modal.
// Each step draws a glowing ring around the ACTUAL control (found via its
// data-tour attribute) so you can see exactly what the guide is describing;
// nothing else is dimmed. The explanation card sits in a fixed spot at the
// bottom-centre and never moves, so it can't cover the control it's pointing
// at or slide off-screen. Persisted in localStorage; replayable via the
// header "?" button.
//
// Positioning note: every target (nav rows, header buttons, brand, mode
// toggle) is always mounted at a fixed spot regardless of the active view,
// so we measure it synchronously in a layout effect and lock page scroll so
// no stray offset can shift the ring. The card is deliberately NOT given the
// `.panel` class — that class sets `position: relative`, which (as plain CSS
// outside Tailwind's layer) overrides the `fixed` utility and would drop the
// card into normal flow. Its panel look is applied with explicit utilities.
import { useEffect, useLayoutEffect, useState } from "react";
import {
  AskIcon,
  ReasonIcon,
  DataIcon,
  DroneIcon,
  CheckIcon,
  DownloadIcon,
  HelpIcon,
  LayersIcon,
  SignalIcon,
} from "./icons";

export const ONBOARDED_KEY = "skylark_console_onboarded_v1";

type View = "ask" | "reasoning" | "data";

interface Step {
  target: string; // matches a data-tour="..." attribute in console/page.tsx
  Icon: typeof AskIcon;
  title: string;
  body: string;
  view?: View;
  round?: boolean; // circular icon button vs. rectangular row — shapes the ring
}

const STEPS: Step[] = [
  {
    target: "brand",
    Icon: DroneIcon,
    title: "Welcome aboard",
    body: "This console turns two live monday.com boards into plain-language answers, real tables, charts, and a full reasoning trail behind every number. Nine quick stops — the glowing ring points at each control as we go.",
    view: "ask",
  },
  {
    target: "nav-ask",
    Icon: AskIcon,
    title: "Ask",
    body: "Type a question or tap a suggested prompt. Multi-record answers render as real tables, breakdowns get an automatic chart, and every answer carries a confidence score based on how complete the specific data behind it is — not a generic board average.",
    view: "ask",
  },
  {
    target: "nav-reasoning",
    Icon: ReasonIcon,
    title: "Reasoning",
    body: "Every answer is backed by a trail of tool-call “waypoints” — each shows the exact board, filters, and data it read. See the full trail and architecture here, or click the waypoint count under any answer to open it right beside the chat, no tab switch needed.",
    view: "reasoning",
  },
  {
    target: "nav-data",
    Icon: DataIcon,
    title: "Data & Graphs",
    body: "Live row counts, field completeness, and charts for both boards — refreshed automatically, so you never have to ask for a status check.",
    view: "data",
  },
  {
    target: "btn-report",
    Icon: DataIcon,
    title: "Board report",
    body: "A deeper, printable rollup: open pipeline by sector and stage, the cash chain from ordered to collected, and arithmetic consistency checks that catch real data-entry errors on the Work Orders board.",
    round: true,
  },
  {
    target: "btn-export",
    Icon: DownloadIcon,
    title: "Export conversation",
    body: "A session summary plus the full Q&A transcript for this conversation. Download the raw messages as JSON, or print/save the whole thing as a PDF.",
    round: true,
  },
  {
    target: "mode-toggle",
    Icon: LayersIcon,
    title: "Founder vs. Technical",
    body: "Founder mode keeps answers clean. Technical mode always shows the model name and the confidence basis, for anyone who wants to double-check a number.",
  },
  {
    target: "sync-badge",
    Icon: SignalIcon,
    title: "Live sync",
    body: "This dot means board data is live and fresh — it refreshes automatically in the background, so answers never go stale.",
  },
  {
    target: "btn-help",
    Icon: HelpIcon,
    title: "Replay anytime",
    body: "Click the ? here whenever you want to see this tour again. You're set — try ⌘K from anywhere to jump straight to Ask.",
    view: "ask",
    round: true,
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(id: string): Rect | null {
  const el = document.querySelector(`[data-tour="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const RING_PAD = 6;

export function Onboarding({
  open,
  onOpenChange,
  setView,
  onFinish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setView: (v: View) => void;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Reset to step 0 each time the tour opens.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Lock page scroll while the tour runs so no stray offset can shift the
  // fixed-position ring off its target.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  // Switch the underlying view and measure the target synchronously. Targets
  // are always mounted, so no async settling is needed; one next-frame
  // re-measure covers any view-transition reflow.
  useLayoutEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (s.view) setView(s.view);
    const measure = () => setRect(measureTarget(s.target));
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [step, open, setView]);

  if (!open) return null;

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const close = (finished: boolean) => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // localStorage unavailable (private mode, etc.) — tour just replays next visit.
    }
    onOpenChange(false);
    if (finished) onFinish();
  };

  return (
    <>
      {/* the spotlight: a glowing ring around the real control — nothing else dims */}
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] transition-all duration-300 ease-out"
          style={{
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
            borderRadius: s.round ? 999 : 10,
            boxShadow:
              "0 0 0 3px var(--amber), 0 0 0 6px rgba(189,119,24,0.25), 0 0 18px 4px rgba(189,119,24,0.4)",
          }}
        />
      )}

      {/* the explanation card — fixed bottom-centre, never moves or covers the
          highlighted control. NOTE: no `.panel` class (see file header). */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Console guide"
        className="corner-ticks fixed bottom-6 left-1/2 z-[70] w-[360px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-5 py-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <span className="tick">
            guide · {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={() => close(false)}
            className="focus-ring tick text-[color:var(--ink-faint)] transition-colors hover:text-[color:var(--ink)]"
          >
            skip
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--teal-soft)] text-[color:var(--teal-deep)]">
            <s.Icon width={15} height={15} />
          </span>
          <h3 className="text-[15px] font-semibold text-[color:var(--ink)]">{s.title}</h3>
        </div>
        <p className="u-body mt-2 text-[12.5px] leading-relaxed">{s.body}</p>

        <div className="mt-3.5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === step ? "bg-[color:var(--teal)]" : "bg-[color:var(--line)]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((v) => v - 1)}
                className="focus-ring rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? close(true) : setStep((v) => v + 1))}
              className="focus-ring flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {last ? (
                <>
                  <CheckIcon width={12} height={12} /> Start exploring
                </>
              ) : (
                "Next →"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
