// Flight-path visualization of an answer's tool calls. Each tool call is a
// "waypoint" plotted along a dashed survey line — the last one is the active
// target. This is the cartographic replacement for a generic expandable list.
import { toolLabel, argSummary, type ToolTraceEntry } from "./format";

/** Best-effort friendly chips from a (possibly truncated) result preview. */
function resultChips(preview: string): string[] {
  const chips: string[] = [];
  try {
    const obj = JSON.parse(preview) as Record<string, unknown>;
    if (typeof obj.count === "number") chips.push(`${obj.count} records`);
    if (obj.amountTypeUsed) chips.push(String(obj.amountTypeUsed).replace("_", "-"));
    if (Array.isArray(obj.groupBreakdown)) {
      const top = (obj.groupBreakdown as { key?: string }[])[0]?.key;
      if (top) chips.push(`top: ${top}`);
      chips.push(`${(obj.groupBreakdown as unknown[]).length} groups`);
    }
    if (obj.mode) chips.push(String(obj.mode));
    if (typeof obj.dealNamesNotConverted === "number")
      chips.push(`${obj.dealNamesNotConverted} unconverted`);
  } catch {
    // Truncated JSON — fall back to a short raw slice.
    const cleaned = preview.replace(/\s+/g, " ").slice(0, 80);
    if (cleaned) chips.push(cleaned + "…");
  }
  return chips.slice(0, 4);
}

export function WaypointTrail({
  trace,
  dense = false,
}: {
  trace: ToolTraceEntry[];
  dense?: boolean;
}) {
  if (trace.length === 0) {
    return (
      <p className="tick py-2">No tools called — direct response (e.g. a clarifying question).</p>
    );
  }

  return (
    <ol className="relative">
      {trace.map((t, i) => {
        const isLast = i === trace.length - 1;
        const chips = resultChips(t.resultPreview);
        return (
          <li key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
            {/* flight line + waypoint node */}
            <div className="relative flex w-5 flex-col items-center">
              {i !== 0 && (
                <span className="absolute -top-4 h-4 w-px bg-[color:var(--line)]" />
              )}
              <svg width="20" height="20" viewBox="0 0 20 20" className="relative z-10">
                {isLast && (
                  <circle
                    cx="10"
                    cy="10"
                    r="7"
                    fill="none"
                    stroke="var(--amber)"
                    strokeWidth="1"
                    className="ping-ring"
                    style={{ transformOrigin: "10px 10px" }}
                  />
                )}
                <path
                  d="M10 2 17 17 10 13.5 3 17 10 2Z"
                  fill={isLast ? "var(--amber)" : "var(--teal)"}
                  stroke={isLast ? "var(--amber-deep)" : "var(--teal-deep)"}
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
              </svg>
              {!isLast && (
                <svg className="flex-1" width="2" height="100%" preserveAspectRatio="none">
                  <line
                    x1="1"
                    y1="0"
                    x2="1"
                    y2="100%"
                    stroke="var(--teal)"
                    strokeWidth="1.2"
                    className="flightline"
                  />
                </svg>
              )}
            </div>

            {/* waypoint content */}
            <div className="min-w-0 flex-1 pt-[1px]">
              <div className="flex items-baseline gap-2">
                <span className="tick text-[color:var(--teal-deep)]">
                  WP-{String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] font-semibold text-[color:var(--ink)]">
                  {toolLabel(t.name)}
                </span>
                <span className="mono text-[10.5px] text-[color:var(--ink-faint)]">{t.name}</span>
              </div>

              {argSummary(t.arguments) && (
                <div className="mono mt-1 truncate text-[11px] text-[color:var(--ink-soft)]">
                  ▸ {argSummary(t.arguments)}
                </div>
              )}

              {chips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {chips.map((c, ci) => (
                    <span
                      key={ci}
                      className="mono rounded-sm border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] px-1.5 py-0.5 text-[10.5px] text-[color:var(--ink-soft)]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {!dense && (
                <details className="mt-2 group">
                  <summary className="tick cursor-pointer select-none hover:text-[color:var(--teal)]">
                    raw payload
                  </summary>
                  <pre className="scroll-thin mono mt-1.5 max-h-40 overflow-auto rounded border border-[color:var(--line-soft)] bg-[color:var(--panel-inset)] p-2 text-[10px] leading-snug text-[color:var(--ink-soft)]">
                    {t.resultPreview}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
