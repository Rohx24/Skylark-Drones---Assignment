"use client";

// Printable board report — a denser rollup computed live from both boards.
// Opened from a button in the Data & Graphs view; "Print / Save as PDF" uses
// the browser's native print dialog against #board-report-root (see the
// @media print rule in globals.css that hides everything else).
import { useCallback, useEffect, useState } from "react";
import { CloseIcon, DataIcon } from "./icons";
import { inrCompact, inrFull, relativeTime } from "./format";

interface BreakdownRow {
  key: string;
  value: number;
  count: number;
}

interface ConsistencyCheck {
  rule: string;
  detail: string;
  checked: number;
  disagree: number;
  samples: { name: string; detail: string }[];
}

interface ReportData {
  generatedAt: number;
  population: { deals: { rows: number; pct: number }; workOrders: { rows: number; pct: number } };
  stats: {
    openPipelineValue: number;
    openDealsCount: number;
    orderedValue: number;
    billedValue: number;
    collectedValue: number;
    receivableValue: number;
    collectedPctOfBilled: number;
  };
  openPipelineBySector: BreakdownRow[];
  openPipelineByStage: BreakdownRow[];
  excludedNoValueDeals: number;
  cashChain: { label: string; value: number; pctOfOrdered: number | null }[];
  billedBySector: BreakdownRow[];
  executionStatus: BreakdownRow[];
  consistency: ConsistencyCheck[];
  notes: string[];
}

export function BoardReport({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback((refresh = false) => {
    setLoading(true);
    setError(undefined);
    fetch(`/api/report${refresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json);
        else setError(json.error || "unavailable");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "network error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/45 p-4 backdrop-blur-[2px]">
      <div
        id="board-report-root"
        className="panel corner-ticks flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[color:var(--line-soft)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--teal-soft)] text-[color:var(--teal-deep)]">
              <DataIcon width={16} height={16} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-[color:var(--ink)]">Board report</div>
              <div className="tick">computed live from both monday.com boards</div>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="focus-ring rounded-md border border-[color:var(--line)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--ink-soft)] transition-colors hover:border-[color:var(--teal)] hover:text-[color:var(--teal-deep)] disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={!data}
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
          {error && (
            <div className="panel px-4 py-3 text-[13px] text-[color:var(--bad)]">
              Couldn&apos;t load the report: {error}
            </div>
          )}

          {!data && !error && <div className="tick py-10 text-center">reading live boards…</div>}

          {data && (
            <div className="space-y-7">
              <p className="tick">generated {new Date(data.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>

              {/* stat tiles */}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Open pipeline" value={inrCompact(data.stats.openPipelineValue)} sub={`${data.stats.openDealsCount} open deals`} />
                <StatTile label="Billed" value={inrCompact(data.stats.billedValue)} sub="incl. GST" />
                <StatTile
                  label="Collected"
                  value={inrCompact(data.stats.collectedValue)}
                  sub={`${data.stats.collectedPctOfBilled}% of billed`}
                  accent
                />
                <StatTile label="Receivable" value={inrCompact(data.stats.receivableValue)} sub="incl. GST" />
              </section>

              <p className="tick">
                work orders: {data.population.workOrders.rows} rows, {data.population.workOrders.pct}% populated ·
                deals: {data.population.deals.rows} rows, {data.population.deals.pct}% populated
              </p>

              <ReportSection title="Open pipeline by sector" sub="Deals board, open status">
                <BarList rows={data.openPipelineBySector} currency />
                {data.excludedNoValueDeals > 0 && (
                  <ExcludedNote n={data.excludedNoValueDeals} of={data.stats.openDealsCount} />
                )}
              </ReportSection>

              <ReportSection title="Open pipeline by stage" sub="Funnel order">
                <BarList rows={data.openPipelineByStage} currency />
              </ReportSection>

              <ReportSection title="Where the money is" sub="Work orders board, cash chain (incl. GST)">
                <div className="space-y-3">
                  {data.cashChain.map((c, i) => (
                    <div key={c.label}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[13px] text-[color:var(--ink)]">{c.label}</span>
                        <span className="mono text-[12.5px] text-[color:var(--ink)]">{inrCompact(c.value)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--panel-inset)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--teal)]"
                          style={{
                            width: `${i === 0 ? 100 : Math.min(100, c.pctOfOrdered ?? 0)}%`,
                            opacity: i === 0 ? 1 : 0.6 + i * 0.1,
                          }}
                        />
                      </div>
                      {c.pctOfOrdered != null && <div className="tick mt-1">{c.pctOfOrdered}% of ordered</div>}
                    </div>
                  ))}
                </div>
              </ReportSection>

              <ReportSection title="Work orders by execution status" sub="Record counts">
                <BarList rows={data.executionStatus} currency={false} />
              </ReportSection>

              <ReportSection title="Billed value by sector" sub="Work orders board · ex-GST">
                <BarList rows={data.billedBySector} currency />
              </ReportSection>

              <ReportSection title="Consistency checks on work orders" sub={`${data.consistency.length} arithmetic rules reconciled across related columns`}>
                <div className="space-y-2.5">
                  {data.consistency.map((c) =>
                    c.disagree > 0 ? (
                      <div
                        key={c.rule}
                        className="rounded-md border border-[color:var(--amber)]/30 bg-[color:var(--amber-soft)]/25 px-3.5 py-2.5"
                      >
                        <div className="text-[13px] font-semibold text-[color:var(--amber-deep)]">{c.rule}</div>
                        <div className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
                          {c.disagree} of {c.checked} checked rows disagree. {c.detail}
                        </div>
                        {c.samples.map((s) => (
                          <div key={s.name} className="mono mt-1.5 text-[11px] text-[color:var(--ink-faint)]">
                            {s.name}: {s.detail}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div key={c.rule} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[12.5px] text-[color:var(--ink-soft)]">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--teal-soft)] text-[9px] font-bold text-[color:var(--teal-deep)]">
                            ✓
                          </span>
                          {c.rule}
                        </span>
                        <span className="tick text-[color:var(--teal-deep)]">reconciles</span>
                      </div>
                    )
                  )}
                </div>
              </ReportSection>

              {data.notes.length > 0 && (
                <ReportSection title="Read these with the numbers" sub="">
                  <ul className="space-y-2">
                    {data.notes.map((n, i) => (
                      <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--amber)]" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              <p className="tick border-t border-[color:var(--line-soft)] pt-4">
                Every figure is computed from a live read of the monday.com Deals and Work Orders boards
                (synced {relativeTime(data.generatedAt)}). No board data is stored by the application.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-3.5 py-3">
      <div className="tick">{label}</div>
      <div className={`mono mt-1 text-[19px] font-semibold ${accent ? "text-[color:var(--teal-deep)]" : "text-[color:var(--ink)]"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">{sub}</div>
    </div>
  );
}

function ReportSection({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">{title}</h3>
      {sub && <p className="tick mb-3 mt-0.5">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  );
}

function BarList({ rows, currency }: { rows: BreakdownRow[]; currency: boolean }) {
  if (rows.length === 0) return <p className="tick">No matching records.</p>;
  const max = Math.max(...rows.map((r) => (currency ? r.value : r.count)), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const magnitude = currency ? r.value : r.count;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-[color:var(--ink)]">{r.key}</span>
              <span className="mono shrink-0 text-[12.5px] text-[color:var(--ink)]" title={currency ? inrFull(r.value) : undefined}>
                {currency ? inrCompact(r.value) : r.count}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--panel-inset)]">
              <div
                className="h-full rounded-full bg-[color:var(--teal)]"
                style={{ width: `${Math.max(2, (magnitude / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExcludedNote({ n, of }: { n: number; of: number }) {
  return (
    <p className="mt-2 text-[11.5px] text-[color:var(--amber-deep)]">
      {n} of {of} rows excluded for a blank value.
    </p>
  );
}
