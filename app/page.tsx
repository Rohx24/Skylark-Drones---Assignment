"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AskIcon, ReasonIcon, DataIcon, DroneIcon, WaypointIcon, SendIcon } from "@/components/icons";
import { relativeTime } from "@/components/format";

const FEATURES = [
  {
    Icon: AskIcon,
    title: "Ask",
    body: "Natural-language questions over pipeline, revenue, work orders and billing — answered, not spreadsheet-dumped.",
  },
  {
    Icon: ReasonIcon,
    title: "Reasoning",
    body: "See the flight path of tool calls behind every answer, and exactly what data it read — nothing is a black box.",
  },
  {
    Icon: DataIcon,
    title: "Data & Graphs",
    body: "Live board status, field completeness and charts, straight from monday.com — refreshed automatically.",
  },
];

const STEPS = [
  { n: "01", title: "Ask", body: "Type a question, or tap a suggested prompt." },
  { n: "02", title: "Agent reads the boards", body: "Live GraphQL calls to Deals + Work Orders, never cached CSVs." },
  { n: "03", title: "Answer + receipts", body: "A plain-language answer, with the reasoning trail behind it." },
];

const PREVIEW_ROWS = [
  ["Bugs Bunny", "OWNER_001", "COMPANY137"],
  ["Scooby-Doo", "OWNER_001", "COMPANY137"],
  ["Shaggy", "OWNER_001", "COMPANY024"],
];

interface InsightsSummary {
  syncedAt: number;
  boards: { key: string; rowCount: number }[];
}

export default function Landing() {
  const [insights, setInsights] = useState<InsightsSummary | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/insights")
      .then((r) => r.json())
      .then((json) => {
        if (alive && json.ok) setInsights(json);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const deals = insights?.boards.find((b) => b.key === "deals")?.rowCount;
  const workOrders = insights?.boards.find((b) => b.key === "workOrders")?.rowCount;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* faint survey/contour motif, top-right */}
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] opacity-[0.35]"
        viewBox="0 0 200 200"
        fill="none"
        stroke="var(--teal)"
        aria-hidden
      >
        {[70, 56, 42, 28].map((r, i) => (
          <ellipse key={r} cx="110" cy="90" rx={r} ry={r * 0.72} strokeOpacity={0.12 - i * 0.02} />
        ))}
        <path d="M20 150 L70 120 L100 132 L140 96 L182 108" strokeOpacity="0.28" strokeDasharray="3 4" />
        {[[70, 120], [140, 96]].map(([x, y]) => (
          <path key={x} d={`M${x} ${y - 6} L${x + 5} ${y + 5} L${x} ${y + 2} L${x - 5} ${y + 5} Z`} fill="var(--amber)" stroke="none" />
        ))}
      </svg>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 md:px-10">
        {/* top bar */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span className="text-[color:var(--teal)]">
              <DroneIcon width={22} height={22} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-[color:var(--ink)]">
              Skylark Survey Console
            </span>
          </div>
          <Link
            href="/console"
            className="u-meta rounded-md px-3 py-1.5 text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--teal-deep)]"
          >
            Launch console →
          </Link>
        </header>

        {/* hero */}
        <section className="grid flex-1 grid-cols-1 items-center gap-14 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="tick text-[color:var(--teal-deep)]">Aerial business intelligence</span>
            <h1 className="mt-4 max-w-xl text-[38px] font-semibold leading-[1.1] tracking-[-0.02em] text-[color:var(--ink)] md:text-[50px]">
              Your survey data,
              <br />
              answered in plain language.
            </h1>
            <p className="u-lead mt-6 max-w-lg">
              A conversational BI console for Skylark Drones. Ask about pipeline, revenue, work
              orders and billing across two live monday.com boards — and get an answer, not a
              spreadsheet. Every figure is computed from a real board read, never estimated by the
              model.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/console"
                className="flex items-center gap-2 rounded-lg bg-[color:var(--teal)] px-5 py-3 text-[14.5px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <WaypointIcon width={16} height={16} /> Launch the console
              </Link>
              <Link
                href="/console"
                className="rounded-lg px-4 py-3 text-[14px] text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--teal-deep)]"
              >
                See how it thinks →
              </Link>
            </div>

            {/* live stat strip */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <StatChip value={deals} label="deals tracked" />
              <StatChip value={workOrders} label="work orders" />
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="ping-ring absolute inline-flex h-full w-full rounded-full bg-[color:var(--teal)]" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--teal)]" />
                </span>
                <span className="tick">
                  {insights ? `synced ${relativeTime(insights.syncedAt)}` : "connecting to live boards…"}
                </span>
              </div>
            </div>
          </div>

          {/* product preview mock */}
          <div className="relative">
            <div className="panel corner-ticks px-5 py-5 shadow-sm">
              <div className="mb-3.5 flex items-center justify-between">
                <span className="tick">example · ask view</span>
                <span className="tick text-[color:var(--teal-deep)]">live board read</span>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-lg bg-[color:var(--ink)] px-3.5 py-2 text-[12.5px] leading-snug text-[color:var(--paper)]">
                  Which mining sector deals are in the Lead stage?
                </div>
              </div>

              <div className="mt-3 space-y-2.5">
                <p className="text-[13px] leading-relaxed text-[color:var(--ink)]">
                  There are <strong className="font-semibold">41 deals</strong> in the Mining sector
                  at the Lead stage. Here are a few:
                </p>

                <div className="overflow-hidden rounded-md border border-[color:var(--line-soft)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-[color:var(--panel-inset)]">
                        <th className="px-2.5 py-1.5 text-left tick">Deal</th>
                        <th className="px-2.5 py-1.5 text-left tick">Owner</th>
                        <th className="px-2.5 py-1.5 text-left tick">Client</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PREVIEW_ROWS.map((r) => (
                        <tr key={r[0]} className="border-t border-[color:var(--line-soft)]">
                          {r.map((c) => (
                            <td key={c} className="px-2.5 py-1.5 text-[color:var(--ink-soft)]">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-md border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-3 py-2.5">
                  <div className="tick mb-2">deals by sector</div>
                  <div className="flex items-end gap-2.5">
                    {[
                      { label: "Mining", h: 100, c: "var(--teal)" },
                      { label: "Renew.", h: 58, c: "var(--teal-soft)" },
                      { label: "DSP", h: 30, c: "var(--teal-soft)" },
                      { label: "S&S", h: 16, c: "var(--teal-soft)" },
                    ].map((b) => (
                      <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm"
                          style={{ height: `${b.h * 0.4}px`, background: b.c }}
                        />
                        <span className="tick">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-lg border border-[color:var(--line)]" />
          </div>
        </section>

        {/* how it works */}
        <section className="border-t border-[color:var(--line-soft)] py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative flex gap-3.5">
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-9 hidden h-px w-full border-t border-dashed border-[color:var(--line)] sm:block"
                  />
                )}
                <span className="mono z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--teal)] bg-[color:var(--panel)] text-[11px] font-semibold text-[color:var(--teal-deep)]">
                  {s.n}
                </span>
                <div className="pt-1">
                  <div className="text-[14px] font-semibold text-[color:var(--ink)]">{s.title}</div>
                  <div className="u-meta mt-1 leading-relaxed">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* feature row */}
        <section className="border-t border-[color:var(--line-soft)] py-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="panel group flex flex-col gap-2.5 px-4 py-4 transition-colors hover:border-[color:var(--teal)]/40"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--teal-soft)] text-[color:var(--teal-deep)]">
                  <f.Icon width={16} height={16} />
                </span>
                <span className="text-[14.5px] font-semibold text-[color:var(--ink)]">{f.title}</span>
                <span className="u-meta leading-relaxed">{f.body}</span>
              </div>
            ))}
          </div>
        </section>

        {/* closing CTA */}
        <section className="border-t border-[color:var(--line-soft)] py-10">
          <div className="panel corner-ticks flex flex-col items-start justify-between gap-4 px-6 py-6 sm:flex-row sm:items-center">
            <div>
              <div className="text-[16px] font-semibold text-[color:var(--ink)]">
                Ready to ask your first question?
              </div>
              <div className="u-meta mt-1">First time in? The console opens a 30-second guided tour.</div>
            </div>
            <Link
              href="/console"
              className="flex shrink-0 items-center gap-2 rounded-lg bg-[color:var(--teal)] px-5 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Launch the console <SendIcon width={15} height={15} />
            </Link>
          </div>
        </section>

        {/* trust footer */}
        <footer className="border-t border-[color:var(--line-soft)] py-5">
          <p className="u-meta">
            Live monday.com data · Deals + Work Orders · figures computed server-side, never
            estimated · masked values.
          </p>
        </footer>
      </div>
    </main>
  );
}

function StatChip({ value, label }: { value?: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="mono text-[15px] font-semibold text-[color:var(--ink)]">
        {value ?? "–"}
      </span>
      <span className="tick">{label}</span>
    </div>
  );
}
