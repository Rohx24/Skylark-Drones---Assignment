// Real, live computations for the Data & Graphs view and the per-answer
// confidence indicator. Everything here reads through the SAME shared data
// layer (getBoards) and tool layer (queryDeals/queryWorkOrders) the agent
// uses — no duplicated query logic, no sample data.

import { getBoards } from "./data";
import { queryDeals, queryWorkOrders } from "./tools";
import { summarizeDeals, summarizeWorkOrders, crossBoardOverlap } from "./quality";
import { DEALS_BOARD_ID, WORK_ORDERS_BOARD_ID } from "./types";
import type { DealRecord, WorkOrderRecord } from "./types";

// Canonical pipeline order for charting.
const STAGE_ORDER = [
  "Lead",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
  "On Hold",
  "Irrelevant",
  "Unknown",
];

export interface FieldFill {
  label: string;
  filled: number;
  total: number;
  fillPct: number;
}

export interface BoardStatus {
  key: "deals" | "workOrders";
  title: string;
  boardId: string;
  connected: boolean;
  rowCount: number;
  completeness: number; // 0-100, avg fill across core fields
  fields: FieldFill[];
}

function fillPct(filled: number, total: number): number {
  return total === 0 ? 0 : Math.round((filled / total) * 1000) / 10;
}

function boardCompleteness(
  fields: { label: string; filled: number }[],
  total: number
): { completeness: number; fields: FieldFill[] } {
  const detailed = fields.map((f) => ({
    label: f.label,
    filled: f.filled,
    total,
    fillPct: fillPct(f.filled, total),
  }));
  const completeness =
    detailed.length === 0
      ? 0
      : Math.round(
          (detailed.reduce((a, f) => a + f.fillPct, 0) / detailed.length) * 10
        ) / 10;
  return { completeness, fields: detailed };
}

export function dealsStatus(deals: DealRecord[]): BoardStatus {
  const n = deals.length;
  const { completeness, fields } = boardCompleteness(
    [
      { label: "Deal value", filled: deals.filter((d) => d.maskedDealValue != null).length },
      { label: "Stage", filled: deals.filter((d) => d.dealStage.canonical !== "Unknown").length },
      { label: "Sector", filled: deals.filter((d) => d.sectorService != null).length },
      { label: "Owner", filled: deals.filter((d) => d.ownerCode != null).length },
      { label: "Client code", filled: deals.filter((d) => d.clientCode != null).length },
      { label: "Created date", filled: deals.filter((d) => d.createdDate.iso != null).length },
    ],
    n
  );
  return {
    key: "deals",
    title: "Deals",
    boardId: DEALS_BOARD_ID,
    connected: true,
    rowCount: n,
    completeness,
    fields,
  };
}

export function workOrdersStatus(wos: WorkOrderRecord[]): BoardStatus {
  const n = wos.length;
  const { completeness, fields } = boardCompleteness(
    [
      { label: "Billed value (ex-GST)", filled: wos.filter((w) => w.billedValueExclGst != null).length },
      { label: "Sector", filled: wos.filter((w) => w.sector != null).length },
      { label: "Customer code", filled: wos.filter((w) => w.customerNameCode != null).length },
      { label: "Execution status", filled: wos.filter((w) => w.executionStatus != null).length },
      { label: "PO / LOI date", filled: wos.filter((w) => w.poLoiDate.iso != null).length },
      { label: "Amount receivable", filled: wos.filter((w) => w.amountReceivable != null).length },
    ],
    n
  );
  return {
    key: "workOrders",
    title: "Work Orders",
    boardId: WORK_ORDERS_BOARD_ID,
    connected: true,
    rowCount: n,
    completeness,
    fields,
  };
}

export async function getBoardStatuses(): Promise<{
  statuses: BoardStatus[];
  syncedAt: number;
}> {
  const { deals, workOrders, fetchedAt } = await getBoards();
  return {
    statuses: [dealsStatus(deals), workOrdersStatus(workOrders)],
    syncedAt: fetchedAt,
  };
}

// ---------------------------------------------------------------------------
// Charts — computed via the SAME tool layer (groupBy) the agent calls.
// ---------------------------------------------------------------------------

export interface InsightsPayload {
  syncedAt: number;
  boards: BoardStatus[];
  charts: {
    pipelineByStage: { stage: string; value: number; count: number }[];
    billedBySector: { sector: string; billedExcl: number; billedIncl: number; count: number }[];
    billingStatus: { status: string; count: number }[];
  };
  dataQuality: {
    deals: ReturnType<typeof summarizeDeals>;
    workOrders: ReturnType<typeof summarizeWorkOrders>;
    crossBoard: ReturnType<typeof crossBoardOverlap>;
  };
}

export async function getInsights(): Promise<InsightsPayload> {
  const { deals, workOrders, fetchedAt } = await getBoards();

  const [stageGroups, sectorGroups, billingGroups] = await Promise.all([
    queryDeals({ groupBy: "stage" }),
    queryWorkOrders({ groupBy: "sector" }),
    queryWorkOrders({ groupBy: "billingStatus" }),
  ]);

  const stageRows = (stageGroups.groupBreakdown as { key: string; valueSum: number; count: number }[]) ?? [];
  const pipelineByStage = stageRows
    .map((g) => ({ stage: g.key, value: Math.round(g.valueSum), count: g.count }))
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const sectorRows =
    (sectorGroups.groupBreakdown as {
      key: string;
      billedValueExclGstSum: number;
      billedValueInclGstSum: number;
      count: number;
    }[]) ?? [];
  const billedBySector = sectorRows.map((g) => ({
    sector: g.key,
    billedExcl: Math.round(g.billedValueExclGstSum),
    billedIncl: Math.round(g.billedValueInclGstSum),
    count: g.count,
  }));

  const billingRows = (billingGroups.groupBreakdown as { key: string; count: number }[]) ?? [];
  const billingStatus = billingRows.map((g) => ({ status: g.key, count: g.count }));

  return {
    syncedAt: fetchedAt,
    boards: [dealsStatus(deals), workOrdersStatus(workOrders)],
    charts: { pipelineByStage, billedBySector, billingStatus },
    dataQuality: {
      deals: summarizeDeals(deals),
      workOrders: summarizeWorkOrders(workOrders),
      crossBoard: crossBoardOverlap(deals, workOrders),
    },
  };
}

// ---------------------------------------------------------------------------
// Confidence — real field-completeness of the board(s) an answer's tools used.
// NOT a measure of interpretation correctness; clearly labelled as such.
// ---------------------------------------------------------------------------

export interface Confidence {
  score: number; // 0-100
  level: "High" | "Moderate" | "Limited";
  basis: string;
  boards: { title: string; completeness: number }[];
}

const TOOL_BOARDS: Record<string, ("deals" | "workOrders")[]> = {
  query_deals: ["deals"],
  query_work_orders: ["workOrders"],
  cross_board_lookup: ["deals", "workOrders"],
  get_data_quality_summary: ["deals", "workOrders"],
};

/** Null when no data tool ran (e.g. a clarifying question) — show nothing. */
export function computeConfidence(
  toolTrace: { name: string; fieldCompleteness?: number }[],
  statuses: BoardStatus[]
): Confidence | null {
  const used = new Set<"deals" | "workOrders">();
  const perCallScores: number[] = [];
  for (const t of toolTrace) {
    for (const b of TOOL_BOARDS[t.name] ?? []) used.add(b);
    if (t.fieldCompleteness != null) perCallScores.push(t.fieldCompleteness);
  }
  if (used.size === 0) return null;

  const boards = statuses
    .filter((s) => used.has(s.key))
    .map((s) => ({ title: s.title, completeness: s.completeness }));
  if (boards.length === 0) return null;

  // Prefer the real, per-query completeness (how many of THIS answer's
  // matching records actually had the field it's citing) — it moves with
  // the question. Fall back to the board-wide average only for tools with
  // no single obvious field (cross-board lookup, the data-quality scan).
  const usingPerCall = perCallScores.length > 0;
  const score = usingPerCall
    ? Math.round(perCallScores.reduce((a, s) => a + s, 0) / perCallScores.length)
    : Math.round(boards.reduce((a, b) => a + b.completeness, 0) / boards.length);

  const level = score >= 80 ? "High" : score >= 60 ? "Moderate" : "Limited";
  const boardList = boards.map((b) => b.title).join(" + ");
  return {
    score,
    level,
    basis: usingPerCall
      ? `Reflects how many of the specific records behind this answer actually had the field its figure is built from — not the whole board's average.`
      : `Reflects average field completeness of the ${boardList} board${
          boards.length > 1 ? "s" : ""
        } this answer read — not a measure of interpretation.`,
    boards,
  };
}
