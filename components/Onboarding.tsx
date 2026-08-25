"use client";

// First-time-only guided tour of the console. Steps through the three views,
// switching the live pane behind the modal so the tour doubles as a real
// preview. Persisted in localStorage; replayable anytime via the header "?".
import { useEffect, useState } from "react";
import { AskIcon, ReasonIcon, DataIcon, DroneIcon, CheckIcon } from "./icons";

export const ONBOARDED_KEY = "skylark_console_onboarded_v1";

type View = "ask" | "reasoning" | "data";

interface Step {
  Icon: typeof AskIcon;
  title: string;
  body: string;
  view?: View;
}

const STEPS: Step[] = [
  {
    Icon: DroneIcon,
    title: "Welcome aboard",
    body: "This console turns two live monday.com boards into plain-language answers. A 30-second tour — three views, one shortcut — then you're flying solo.",
    view: "ask",
  },
  {
    Icon: AskIcon,
    title: "Ask",
    body: "Type a question about pipeline, revenue, work orders or billing — or tap a suggested prompt. Every answer is computed from a live board read. Multi-record answers render as real tables, and breakdowns get an automatic chart.",
    view: "ask",
  },
  {
    Icon: ReasonIcon,
    title: "Reasoning",
    body: "Curious how an answer was built? This view shows exactly which tools ran and what data came back for the last question — nothing here is a black box.",
    view: "reasoning",
  },
  {
    Icon: DataIcon,
    title: "Data & Graphs",
    body: "Live row counts, field completeness and charts for both boards — refreshed automatically. No need to ask for a status check.",
    view: "data",
  },
];

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    setStep(0);
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const v = STEPS[step].view;
    if (v) setView(v);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Console guide"
    >
      <div
        className={`panel corner-ticks w-full max-w-sm px-5 py-5 shadow-xl transition-all duration-200 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="tick">
            guide · step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={() => close(false)}
            className="focus-ring tick text-[color:var(--ink-faint)] transition-colors hover:text-[color:var(--ink)]"
          >
            skip
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--teal-soft)] text-[color:var(--teal-deep)]">
            <s.Icon width={18} height={18} />
          </span>
          <h3 className="u-h1 text-[19px]">{s.title}</h3>
        </div>
        <p className="u-body mt-3">{s.body}</p>

        <div className="mt-5 flex items-center justify-between">
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
                className="focus-ring rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? close(true) : setStep((v) => v + 1))}
              className="focus-ring flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {last ? (
                <>
                  <CheckIcon width={13} height={13} /> Start exploring
                </>
              ) : (
                "Next →"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
