// Board report — a denser, printable rollup on top of the same live boards
// used everywhere else in the app. Every figure here is computed fresh from
// getBoards(); nothing is hardcoded or estimated. Consistency checks
// reconcile the board's OWN numeric columns against each other (e.g. does
// "amount receivable" actually equal billed minus collected) so they surface
// real keying errors, not invented ones.

import { getBoards } from "./data";
import { dealsStatus, workOrdersStatus } from "./insights";
import type { WorkOrderRecord } from "./types";

const STAGE_ORDER = ["Lead", "Qualified", "Proposal", "Negotiation", "On Hold", "Won", "Lost", "Irrelevant", "Unknown"];
const EPS = 1; // ₹1 tolerance for rupee figures — real rounding noise, not a data error
const QTY_EPS = 0.05; // quantities are small numbers (HA/MW/etc.); ₹1-scale tolerance would hide real gaps

function sum(nums: (number | null)[]): number {
  return nums.reduce<number>((a, n) => a + (n ?? 0), 0);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface BreakdownRow {
  key: string;
  value: number;
  count: number;
}

function byKey<T>(records: T[], keyFn: (r: T) => string, valueFn: (r: T) => number): BreakdownRow[] {
  const groups = new Map<string, { value: number; count: number }>();
  for (const r of records) {
    const k = keyFn(r);
    const g = groups.get(k) ?? { value: 0, count: 0 };
    g.value += valueFn(r);
    g.count += 1;
    groups.set(k, g);
  }
  return Array.from(groups.entries())
    .map(([key, g]) => ({ key, value: Math.round(g.value), count: g.count }))
    .sort((a, b) => b.value - a.value);
}

interface ConsistencyCheck {
  rule: string;
  detail: string;
  checked: number;
  disagree: number;
  samples: { name: string; detail: string }[];
}

function checkRule(
  wos: WorkOrderRecord[],
  rule: string,
  detail: string,
  fields: (w: WorkOrderRecord) => number[] | null, // null = row not eligible for this check
  violates: (vals: number[]) => boolean,
  sampleDetail: (w: WorkOrderRecord, vals: number[]) => string
): ConsistencyCheck {
  const eligible = wos
    .map((w) => ({ w, vals: fields(w) }))
    .filter((x): x is { w: WorkOrderRecord; vals: number[] } => x.vals != null);
  const bad = eligible.filter((x) => violates(x.vals));
  return {
    rule,
    detail,
    checked: eligible.length,
    disagree: bad.length,
    samples: bad.slice(0, 2).map((x) => ({ name: x.w.name, detail: sampleDetail(x.w, x.vals) })),
  };
}

export interface BoardReport {
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

export async function getBoardReport(): Promise<BoardReport> {
  const { deals, workOrders } = await getBoards();
  const dStatus = dealsStatus(deals);
  const wStatus = workOrdersStatus(workOrders);

  const open = deals.filter((d) => (d.dealStatus ?? "").toLowerCase() === "open");
  const openWithValue = open.filter((d) => d.maskedDealValue != null);
  const openPipelineValue = sum(openWithValue.map((d) => d.maskedDealValue));
  const excludedNoValueDeals = open.length - openWithValue.length;

  const openPipelineBySector = byKey(
    openWithValue,
    (d) => d.sectorService ?? "(not set)",
    (d) => d.maskedDealValue ?? 0
  );
  const openPipelineByStage = byKey(
    openWithValue,
    (d) => d.dealStage.canonical,
    (d) => d.maskedDealValue ?? 0
  ).sort((a, b) => STAGE_ORDER.indexOf(a.key) - STAGE_ORDER.indexOf(b.key));

  const orderedValue = sum(workOrders.map((w) => w.amountInclGst));
  const billedValue = sum(workOrders.map((w) => w.billedValueInclGst));
  const collectedValue = sum(workOrders.map((w) => w.collectedAmountInclGst));
  const receivableValue = sum(workOrders.map((w) => w.amountReceivable));

  const cashChain = [
    { label: "Ordered", value: Math.round(orderedValue), pctOfOrdered: null },
    {
      label: "Billed",
      value: Math.round(billedValue),
      pctOfOrdered: orderedValue > 0 ? Math.round((billedValue / orderedValue) * 100) : null,
    },
    {
      label: "Collected",
      value: Math.round(collectedValue),
      pctOfOrdered: orderedValue > 0 ? Math.round((collectedValue / orderedValue) * 100) : null,
    },
  ];

  const billedBySector = byKey(
    workOrders,
    (w) => w.sector ?? "(not set)",
    (w) => w.billedValueExclGst ?? 0
  );
  const executionStatus = byKey(
    workOrders,
    (w) => w.executionStatus ?? "(not set)",
    () => 0
  ).sort((a, b) => b.count - a.count);

  const consistency: ConsistencyCheck[] = [
    checkRule(
      workOrders,
      "Balance quantity should equal ordered minus billed quantity",
      "Ops-recorded ordered quantity minus billed quantity should match the board's own balance figure.",
      (w) =>
        w.quantityByOps != null && w.quantityBilled != null && w.balanceInQuantity != null
          ? [w.quantityByOps, w.quantityBilled, w.balanceInQuantity]
          : null,
      ([ordered, billed, balance]) => Math.abs(ordered - billed - balance) > QTY_EPS,
      (_w, [ordered, billed, balance]) =>
        `Balance is ${balance} but ordered − billed implies ${Math.round((ordered - billed) * 100) / 100}, a gap of ${Math.round(Math.abs(balance - (ordered - billed)) * 100) / 100}`
    ),
    checkRule(
      workOrders,
      "Billed cannot exceed the order value",
      "A work order invoiced for more than its PO/LOI amount is either an over-invoice or a mis-keyed figure.",
      (w) => (w.billedValueInclGst != null && w.amountInclGst != null ? [w.billedValueInclGst, w.amountInclGst] : null),
      ([billed, ordered]) => billed - ordered > EPS,
      (_w, [billed, ordered]) => `Billed ₹${billed.toLocaleString("en-IN")} exceeds ordered ₹${ordered.toLocaleString("en-IN")} by ₹${Math.round(billed - ordered).toLocaleString("en-IN")}`
    ),
    checkRule(
      workOrders,
      "Collected cannot exceed billed",
      "Money collected against a work order should never be more than what was billed for it.",
      (w) => (w.collectedAmountInclGst != null && w.billedValueInclGst != null ? [w.collectedAmountInclGst, w.billedValueInclGst] : null),
      ([collected, billed]) => collected - billed > EPS,
      (_w, [collected, billed]) => `Collected ₹${collected.toLocaleString("en-IN")} exceeds billed ₹${billed.toLocaleString("en-IN")} by ₹${Math.round(collected - billed).toLocaleString("en-IN")}`
    ),
    checkRule(
      workOrders,
      "Receivable should equal billed minus collected",
      "The board's own 'amount receivable' column should match billed minus collected.",
      (w) =>
        w.billedValueInclGst != null && w.collectedAmountInclGst != null && w.amountReceivable != null
          ? [w.billedValueInclGst, w.collectedAmountInclGst, w.amountReceivable]
          : null,
      ([billed, collected, receivable]) => Math.abs(billed - collected - receivable) > EPS,
      (_w, [billed, collected, receivable]) =>
        `Receivable is ₹${receivable.toLocaleString("en-IN")} but billed − collected implies ₹${Math.round(billed - collected).toLocaleString("en-IN")}`
    ),
    checkRule(
      workOrders,
      "Amount still to bill should equal ordered minus billed",
      "The board's own 'to be billed' column should match the order value minus what's already billed (ex-GST).",
      (w) =>
        w.amountExclGst != null && w.billedValueExclGst != null && w.toBeBilledExclGst != null
          ? [w.amountExclGst, w.billedValueExclGst, w.toBeBilledExclGst]
          : null,
      ([ordered, billed, toBill]) => Math.abs(ordered - billed - toBill) > EPS,
      (_w, [ordered, billed, toBill]) =>
        `To-be-billed is ₹${toBill.toLocaleString("en-IN")} but ordered − billed implies ₹${Math.round(ordered - billed).toLocaleString("en-IN")}`
    ),
  ];

  const notes: string[] = [];
  if (excludedNoValueDeals > 0) {
    const med = median(openWithValue.map((d) => d.maskedDealValue as number));
    const projected = openPipelineValue + med * excludedNoValueDeals;
    notes.push(
      `Open pipeline excludes ${excludedNoValueDeals} deal${excludedNoValueDeals === 1 ? "" : "s"} with no recorded value. Projected at the median deal size, the total would be about ₹${(projected / 1e7).toFixed(2)}Cr.`
    );
  }
  for (const c of consistency) {
    if (c.disagree > 0) {
      notes.push(`${c.disagree} row(s) on work orders break the rule: ${c.rule.toLowerCase()}.`);
    }
  }
  if (wStatus.completeness < 90) {
    notes.push(`The Work Orders board is ${wStatus.completeness}% populated, so some totals exclude rows.`);
  }
  if (dStatus.completeness < 90) {
    notes.push(`The Deals board is ${dStatus.completeness}% populated, so some totals exclude rows.`);
  }

  return {
    generatedAt: Date.now(),
    population: {
      deals: { rows: dStatus.rowCount, pct: dStatus.completeness },
      workOrders: { rows: wStatus.rowCount, pct: wStatus.completeness },
    },
    stats: {
      openPipelineValue: Math.round(openPipelineValue),
      openDealsCount: open.length,
      orderedValue: Math.round(orderedValue),
      billedValue: Math.round(billedValue),
      collectedValue: Math.round(collectedValue),
      receivableValue: Math.round(receivableValue),
      collectedPctOfBilled: billedValue > 0 ? Math.round((collectedValue / billedValue) * 100) : 0,
    },
    openPipelineBySector,
    openPipelineByStage,
    excludedNoValueDeals,
    cashChain,
    billedBySector,
    executionStatus,
    consistency,
    notes,
  };
}
