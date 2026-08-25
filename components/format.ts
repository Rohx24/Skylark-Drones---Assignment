// Shared formatting + types for the console frontend.

export interface ChartSeries {
  dimension: string;
  metric: string;
  unit: "currency" | "count";
  points: { label: string; value: number }[];
}

export interface ToolTraceEntry {
  name: string;
  arguments: Record<string, unknown>;
  resultPreview: string;
  chart?: ChartSeries;
}

export interface Confidence {
  score: number;
  level: "High" | "Moderate" | "Limited";
  basis: string;
  boards: { title: string; completeness: number }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolTrace?: ToolTraceEntry[];
  model?: string;
  confidence?: Confidence | null;
  error?: boolean;
}

/** Compact Indian-convention rupee: ₹1.2Cr / ₹3.4L / ₹5,600. Masked values. */
export function inrCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

/** Full grouped rupee for tooltips: ₹7,70,94,768 (Indian grouping). */
export function inrFull(n: number): string {
  const rounded = Math.round(n);
  const s = String(Math.abs(rounded));
  // Indian grouping: last 3 digits, then pairs.
  let out = s;
  if (s.length > 3) {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return `${rounded < 0 ? "-" : ""}₹${out}`;
}

/** Friendly relative time for "last synced". */
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

const TOOL_LABELS: Record<string, string> = {
  query_deals: "Deals board",
  query_work_orders: "Work Orders board",
  cross_board_lookup: "Cross-board link",
  get_data_quality_summary: "Data-quality scan",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

/** Compact one-line summary of tool args for a waypoint header. */
export function argSummary(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return parts.join("  ·  ");
}

/** Build clean markdown for the "Copy for leadership brief" action. */
export function buildBrief(question: string, answer: string, confidence?: Confidence | null): string {
  const stamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const conf = confidence
    ? `\n\n_Data confidence: ${confidence.level} (${confidence.score}% field completeness across ${confidence.boards
        .map((b) => b.title)
        .join(" + ")})._`
    : "";
  return `**Question:** ${question}\n\n${answer.trim()}${conf}\n\n_Source: Skylark BI Agent — live monday.com boards (Deals + Work Orders). Generated ${stamp}. Masked values._`;
}
