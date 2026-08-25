"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SignalIcon, DataIcon } from "./icons";
import { inrCompact, inrFull } from "./format";

const TEAL = "#0e7c72";
const TEAL_SOFT = "#6aa8a0";
const AMBER = "#bd7718";
const SLATE = "#8a979c";
const BAD = "#a2432b";

export interface InsightsData {
  ok: boolean;
  syncedAt: number;
  boards: {
    key: string;
    title: string;
    boardId: string;
    connected: boolean;
    rowCount: number;
    completeness: number;
    fields: { label: string; filled: number; total: number; fillPct: number }[];
  }[];
  charts: {
    pipelineByStage: { stage: string; value: number; count: number }[];
    billedBySector: { sector: string; billedExcl: number; billedIncl: number; count: number }[];
    billingStatus: { status: string; count: number }[];
  };
  dataQuality: {
    deals: { issues: { missingDealValue: number; missingDealValuePct: number } };
    workOrders: { issues: { quantity_unparseable: number; billingStatus_blank: number } };
    crossBoard: { distinctDealNames: number; sharedDistinctNames: number };
  };
}

type ChartDatum = { count: number } & Record<string, number>;
interface TipProps {
  active?: boolean;
  payload?: { payload: ChartDatum; value: number }[];
  label?: string | number;
}

function CurrencyTooltip({ active, payload, label, field }: TipProps & { field: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded border border-[color:var(--line)] bg-[color:var(--panel-2)] px-2.5 py-1.5 shadow-sm">
      <div className="tick text-[color:var(--ink)]">{label}</div>
      <div className="mono text-[12px] text-[color:var(--teal-deep)]">{inrFull(row[field])}</div>
      <div className="mono text-[10px] text-[color:var(--ink-faint)]">{row.count} records</div>
    </div>
  );
}

function CountTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-[color:var(--line)] bg-[color:var(--panel-2)] px-2.5 py-1.5 shadow-sm">
      <div className="tick text-[color:var(--ink)]">{label}</div>
      <div className="mono text-[12px] text-[color:var(--teal-deep)]">{payload[0].value} work orders</div>
    </div>
  );
}

const axisTick = { fontSize: 10, fill: "var(--ink-faint)", fontFamily: "var(--font-mono)" };

export function DataView({ data, error }: { data: InsightsData | null; error?: string }) {
  return (
    <div className="scroll-thin h-full overflow-y-auto px-5 py-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {error && (
          <div className="panel px-4 py-3 text-[13px] text-[color:var(--bad)]">
            Couldn’t load live data: {error}
          </div>
        )}

        {/* board status */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(data?.boards ?? []).map((b) => (
            <div key={b.key} className="panel corner-ticks px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="ping-ring absolute inline-flex h-full w-full rounded-full bg-[color:var(--teal)]" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--teal)]" />
                  </span>
                  <span className="text-[14px] font-semibold text-[color:var(--ink)]">{b.title}</span>
                </div>
                <span className="tick">live</span>
              </div>

              <div className="mt-2.5 flex items-end gap-4">
                <div>
                  <div className="mono text-[24px] font-semibold leading-none text-[color:var(--ink)]">
                    {b.rowCount}
                  </div>
                  <div className="tick mt-1">rows</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="tick">completeness</span>
                    <span className="mono text-[12px] font-semibold text-[color:var(--teal-deep)]">
                      {b.completeness}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--panel-inset)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--teal)]"
                      style={{ width: `${b.completeness}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[color:var(--line-soft)] pt-2.5">
                {b.fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-[color:var(--ink-soft)]">{f.label}</span>
                    <span
                      className="mono text-[10.5px]"
                      style={{ color: f.fillPct >= 80 ? TEAL : f.fillPct >= 50 ? AMBER : BAD }}
                    >
                      {f.fillPct}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="mono mt-2.5 flex items-center gap-1.5 text-[10px] text-[color:var(--ink-faint)]">
                <SignalIcon width={12} height={12} /> board {b.boardId}
              </div>
            </div>
          ))}
        </section>

        {/* charts */}
        <ChartPanel title="Pipeline value by stage" sub="Deals board · masked deal value" tag="DEALS">
          {data && (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={data.charts.pipelineByStage} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <XAxis dataKey="stage" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} angle={-18} textAnchor="end" height={44} />
                <YAxis tickFormatter={(v) => inrCompact(v)} tick={axisTick} tickLine={false} axisLine={false} width={48} />
                <Tooltip cursor={{ fill: "var(--grid)" }} content={<CurrencyTooltip field="value" />} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {data.charts.pipelineByStage.map((d) => (
                    <Cell
                      key={d.stage}
                      fill={d.stage === "Won" ? TEAL : d.stage === "Lost" ? BAD : d.stage === "Irrelevant" ? SLATE : TEAL_SOFT}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartPanel title="Billed value by sector" sub="Work Orders · ex-GST" tag="WORK ORDERS">
            {data && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={data.charts.billedBySector}
                  margin={{ top: 2, right: 12, bottom: 2, left: 8 }}
                >
                  <XAxis type="number" tickFormatter={(v) => inrCompact(v)} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis type="category" dataKey="sector" tick={axisTick} tickLine={false} axisLine={false} width={80} />
                  <Tooltip cursor={{ fill: "var(--grid)" }} content={<CurrencyTooltip field="billedExcl" />} />
                  <Bar dataKey="billedExcl" radius={[0, 2, 2, 0]}>
                    {data.charts.billedBySector.map((d, i) => (
                      <Cell key={d.sector} fill={i === 0 ? TEAL : TEAL_SOFT} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>

          <ChartPanel title="Billing status" sub="Work Orders · record counts" tag="WORK ORDERS">
            {data && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={[...data.charts.billingStatus].sort((a, b) => b.count - a.count)}
                  margin={{ top: 2, right: 12, bottom: 2, left: 8 }}
                >
                  <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis type="category" dataKey="status" tick={axisTick} tickLine={false} axisLine={false} width={92} />
                  <Tooltip cursor={{ fill: "var(--grid)" }} content={<CountTooltip />} />
                  <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                    {[...data.charts.billingStatus]
                      .sort((a, b) => b.count - a.count)
                      .map((d) => (
                        <Cell
                          key={d.status}
                          fill={
                            d.status === "Blank"
                              ? SLATE
                              : /Billed/.test(d.status)
                              ? TEAL
                              : AMBER
                          }
                        />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>
        </div>

        {/* trust surface: known data-quality issues */}
        {data && (
          <section className="panel corner-ticks px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-2 text-[color:var(--amber)]">
              <DataIcon width={16} height={16} />
              <span className="tick text-[color:var(--amber-deep)]">Known data-quality notes</span>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <QualityNote
                figure={`${data.dataQuality.deals.issues.missingDealValuePct}%`}
                label="of deals have no recorded value — value totals reflect only deals that do."
              />
              <QualityNote
                figure="filtered"
                label="corrupted header-artifact rows (a cell equal to its column title) are dropped before analysis."
              />
              <QualityNote
                figure={`${data.dataQuality.crossBoard.sharedDistinctNames}`}
                label={`deal names appear on both boards — cross-board links are name-based & approximate (names repeat across records).`}
              />
            </ul>
          </section>
        )}

        {!data && !error && (
          <div className="panel px-4 py-8 text-center">
            <span className="tick">reading live boards…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  sub,
  tag,
  children,
}: {
  title: string;
  sub: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel corner-ticks px-4 py-3.5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-[13.5px] font-semibold text-[color:var(--ink)]">{title}</h3>
          <p className="tick mt-0.5">{sub}</p>
        </div>
        <span className="tick text-[color:var(--teal-deep)]">{tag}</span>
      </div>
      {children}
    </div>
  );
}

function QualityNote({ figure, label }: { figure: string; label: string }) {
  return (
    <li className="flex flex-col gap-1 rounded border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-3 py-2.5">
      <span className="mono text-[16px] font-semibold text-[color:var(--amber-deep)]">{figure}</span>
      <span className="text-[11px] leading-relaxed text-[color:var(--ink-soft)]">{label}</span>
    </li>
  );
}
