"use client";

// Compact inline chart for a single answer, rendered under the chat text.
// Same visual language as the Data & Graphs tab (horizontal recharts bars,
// teal palette, mono ticks) — just smaller. Data comes verbatim from the
// answer's own tool result (ChartSeries), so bars always match the text.
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inrCompact, inrFull, type ChartSeries } from "./format";

const TEAL = "#0e7c72";
const TEAL_SOFT = "#6aa8a0";

type Datum = { label: string; value: number };

function MiniTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: Datum }[];
  unit: "currency" | "count";
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded border border-[color:var(--line)] bg-[color:var(--panel-2)] px-2 py-1 shadow-sm">
      <div className="tick text-[color:var(--ink)]">{row.label}</div>
      <div className="mono text-[11px] text-[color:var(--teal-deep)]">
        {unit === "currency" ? inrFull(row.value) : `${row.value}`}
      </div>
    </div>
  );
}

const axisTick = { fontSize: 9.5, fill: "var(--ink-faint)", fontFamily: "var(--font-mono)" };

export function MiniBarChart({ chart }: { chart: ChartSeries }) {
  const height = Math.max(84, chart.points.length * 24 + 24);
  const fmt = chart.unit === "currency" ? (v: number) => inrCompact(v) : (v: number) => `${v}`;

  return (
    <div className="mt-4 rounded-lg bg-[color:var(--panel)] px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="tick text-[color:var(--teal-deep)]">
          {chart.metric} by {chart.dimension}
        </span>
        <span className="tick">{chart.points.length} groups</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart layout="vertical" data={chart.points} margin={{ top: 0, right: 10, bottom: 0, left: 4 }}>
          <XAxis type="number" tickFormatter={fmt} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} height={16} />
          <YAxis type="category" dataKey="label" tick={axisTick} tickLine={false} axisLine={false} width={78} />
          <Tooltip cursor={{ fill: "var(--grid)" }} content={<MiniTooltip unit={chart.unit} />} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={12}>
            {chart.points.map((_, i) => (
              <Cell key={i} fill={i === 0 ? TEAL : TEAL_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
