// Agent tools — each backed by the Phase 1 board fetchers (via the cached
// getBoards()) with in-memory filtering and aggregation.
//
// Design principle: the TOOLS do the counting and summing, never the model.
// Every number the model can cite comes from here, so figures always trace
// back to real board data (the system prompt forbids fabrication, and this is
// what makes that enforceable).

import { getBoards } from "./data";
import {
  summarizeDeals,
  summarizeWorkOrders,
  crossBoardOverlap,
} from "./quality";
import type { DealRecord, WorkOrderRecord } from "./types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Case-insensitive substring match; null field never matches a set filter. */
function matches(field: string | null, filter?: string | null): boolean {
  if (filter == null || filter === "") return true;
  if (field == null) return false;
  return field.toLowerCase().includes(filter.toLowerCase());
}

/** ISO date within [from, to] (inclusive). Missing date fails a set range. */
function inRange(iso: string | null, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (iso == null) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function sum(nums: (number | null)[]): number {
  return nums.reduce<number>((a, n) => a + (n ?? 0), 0);
}

// ---------------------------------------------------------------------------
// query_deals
// ---------------------------------------------------------------------------

export interface DealFilters {
  sector?: string;
  stage?: string; // canonical bucket, e.g. "Won", "Lead", "Negotiation"
  owner?: string;
  clientCode?: string;
  closureProbability?: string; // High / Medium / Low
  createdFrom?: string; // ISO
  createdTo?: string;
  closeFrom?: string; // ISO (tentative close date)
  closeTo?: string;
  groupBy?: "sector" | "stage" | "owner" | "clientCode";
}

/** Rank closure probability so we can sort "best opportunity" queries. */
function probabilityRank(p: string | null): number {
  if (p == null) return 0;
  const s = p.toLowerCase();
  if (s.includes("high")) return 3;
  if (s.includes("medium")) return 2;
  if (s.includes("low")) return 1;
  return 0;
}

export async function queryDeals(filters: DealFilters = {}) {
  const { deals } = await getBoards();

  const filtered = deals.filter(
    (d) =>
      matches(d.sectorService, filters.sector) &&
      (filters.stage
        ? d.dealStage.canonical.toLowerCase() === filters.stage.toLowerCase()
        : true) &&
      matches(d.ownerCode, filters.owner) &&
      matches(d.closureProbability, filters.closureProbability) &&
      matches(d.clientCode, filters.clientCode) &&
      inRange(d.createdDate.iso, filters.createdFrom, filters.createdTo) &&
      inRange(d.tentativeCloseDate.iso, filters.closeFrom, filters.closeTo)
  );

  const withValue = filtered.filter((d) => d.maskedDealValue != null);
  const valueSum = sum(filtered.map((d) => d.maskedDealValue));

  const result: Record<string, unknown> = {
    count: filtered.length,
    dealValue: {
      note: "Deal value is masked pipeline value (NOT actual revenue — that lives on the Work Orders board as billed/collected amounts).",
      sum: valueSum,
      countWithValue: withValue.length,
      countMissingValue: filtered.length - withValue.length,
      missingValuePct:
        filtered.length === 0
          ? 0
          : Math.round(((filtered.length - withValue.length) / filtered.length) * 1000) / 10,
      warning:
        filtered.length - withValue.length > 0
          ? "Sum reflects ONLY deals that have a recorded value; the rest are excluded. Cite this."
          : undefined,
    },
    filtersApplied: filters,
    stageBreakdown: countBy(filtered, (d) => d.dealStage.canonical),
  };

  if (filters.groupBy) {
    result.groupBreakdown = groupDeals(filtered, filters.groupBy);
  }

  // Surface the most promising records first (closure probability, then value)
  // so "best opportunity" style queries see the right rows within the cap.
  const ranked = [...filtered].sort(
    (a, b) =>
      probabilityRank(b.closureProbability) - probabilityRank(a.closureProbability) ||
      (b.maskedDealValue ?? 0) - (a.maskedDealValue ?? 0)
  );
  result.sample = ranked.slice(0, 40).map(trimDeal);
  return result;
}

function groupDeals(records: DealRecord[], by: NonNullable<DealFilters["groupBy"]>) {
  const keyFn = (d: DealRecord): string => {
    switch (by) {
      case "sector":
        return d.sectorService ?? "(no sector)";
      case "stage":
        return d.dealStage.canonical;
      case "owner":
        return d.ownerCode ?? "(no owner)";
      case "clientCode":
        return d.clientCode ?? "(no client code)";
    }
  };
  const groups = new Map<string, DealRecord[]>();
  for (const d of records) {
    const k = keyFn(d);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  return Array.from(groups.entries())
    .map(([key, rs]) => {
      const withValue = rs.filter((d) => d.maskedDealValue != null);
      return {
        key,
        count: rs.length,
        valueSum: sum(rs.map((d) => d.maskedDealValue)),
        countWithValue: withValue.length,
        countMissingValue: rs.length - withValue.length,
      };
    })
    .sort((a, b) => b.valueSum - a.valueSum || b.count - a.count);
}

const TENDER_NOTE =
  "Sector value 'Tender' is a known data artifact, not a real sector — treat with caution and flag it in any answer that cites this record.";

function trimDeal(d: DealRecord) {
  const rec: Record<string, unknown> = {
    name: d.name,
    stage: d.dealStage.canonical,
    stageRaw: d.dealStage.raw,
    sector: d.sectorService,
    owner: d.ownerCode,
    clientCode: d.clientCode,
    value: d.maskedDealValue,
    closureProbability: d.closureProbability,
    createdDate: d.createdDate.iso,
    tentativeCloseDate: d.tentativeCloseDate.iso,
  };
  // Bake the Phase 1 "Tender is not a real sector" flag into the record itself
  // so record-level answers can't silently cite it as fact.
  if (d.sectorIsTender) rec.dataQualityNote = TENDER_NOTE;
  return rec;
}

// ---------------------------------------------------------------------------
// query_work_orders
// ---------------------------------------------------------------------------

export interface WorkOrderFilters {
  sector?: string;
  executionStatus?: string;
  billingStatus?: string; // canonical: Billed / Partially Billed / Not Billable / Update Required / Stuck / Blank
  customerCode?: string;
  woStatus?: string; // "Open" / "Closed" (WO Status billed)
  amountType?: "excl_gst" | "incl_gst"; // which Billed Value the primary sum uses
  dateField?: "poLoiDate" | "dataDeliveryDate" | "probableStartDate" | "probableEndDate" | "lastInvoiceDate";
  dateFrom?: string;
  dateTo?: string;
  groupBy?: "sector" | "billingStatus" | "executionStatus" | "customerCode" | "woStatus";
}

export async function queryWorkOrders(filters: WorkOrderFilters = {}) {
  const { workOrders } = await getBoards();

  const dateField = filters.dateField ?? "poLoiDate";
  const filtered = workOrders.filter(
    (w) =>
      matches(w.sector, filters.sector) &&
      matches(w.executionStatus, filters.executionStatus) &&
      (filters.billingStatus
        ? w.billingStatus.canonical.toLowerCase() ===
          filters.billingStatus.toLowerCase()
        : true) &&
      matches(w.customerNameCode, filters.customerCode) &&
      matches(w.woStatusBilled, filters.woStatus) &&
      inRange(w[dateField].iso, filters.dateFrom, filters.dateTo)
  );

  // GST handling: return BOTH billed-value sums always, and set a primary
  // `billedValueSum` per amountType. Default is excl_gst — GST is a pass-through
  // tax collected on the government's behalf, not revenue, so excl-GST is the
  // truer "revenue" figure. numeric_mm6jb84y = Excl, numeric_mm6j4bz = Incl
  // (verified against the live board).
  const amountType = filters.amountType ?? "excl_gst";
  const billedExclSum = sum(filtered.map((w) => w.billedValueExclGst));
  const billedInclSum = sum(filtered.map((w) => w.billedValueInclGst));
  const primaryBilledSum = amountType === "excl_gst" ? billedExclSum : billedInclSum;

  const result: Record<string, unknown> = {
    count: filtered.length,
    amountTypeUsed: amountType,
    amounts: {
      scope:
        "GRAND TOTAL across ALL matching work orders combined (every group in this result). Do NOT cite these figures for a single sector/group — for one group use ITS row in groupBreakdown, which carries its own billedValueExclGstSum and billedValueInclGstSum.",
      note: "Masked rupee amounts. 'billedValueSum' reflects amountTypeUsed (excl vs incl GST); both raw sums are also given. Excl GST = numeric_mm6jb84y, Incl GST = numeric_mm6j4bz.",
      billedValueSum: primaryBilledSum,
      billedValueExclGstSum: billedExclSum,
      billedValueInclGstSum: billedInclSum,
      collectedAmountInclGstSum: sum(filtered.map((w) => w.collectedAmountInclGst)),
      amountReceivableSum: sum(filtered.map((w) => w.amountReceivable)),
      countMissingBilledExclGst: filtered.filter((w) => w.billedValueExclGst == null).length,
      countMissingBilledInclGst: filtered.filter((w) => w.billedValueInclGst == null).length,
      countMissingReceivable: filtered.filter((w) => w.amountReceivable == null).length,
    },
    billingStatusBreakdown: countBy(filtered, (w) => w.billingStatus.canonical),
    executionStatusBreakdown: countBy(filtered, (w) => w.executionStatus ?? "(none)"),
    woStatusBreakdown: countBy(filtered, (w) => w.woStatusBilled ?? "(none)"),
    filtersApplied: { ...filters, dateFieldUsed: dateField, amountTypeUsed: amountType },
  };

  if (filters.groupBy) {
    result.groupBreakdown = groupWorkOrders(filtered, filters.groupBy, amountType);
  }

  result.sample = filtered.slice(0, 40).map(trimWorkOrder);
  return result;
}

function groupWorkOrders(
  records: WorkOrderRecord[],
  by: NonNullable<WorkOrderFilters["groupBy"]>,
  amountType: "excl_gst" | "incl_gst"
) {
  const keyFn = (w: WorkOrderRecord): string => {
    switch (by) {
      case "sector":
        return w.sector ?? "(no sector)";
      case "billingStatus":
        return w.billingStatus.canonical;
      case "executionStatus":
        return w.executionStatus ?? "(none)";
      case "customerCode":
        return w.customerNameCode ?? "(no customer code)";
      case "woStatus":
        return w.woStatusBilled ?? "(none)";
    }
  };
  const groups = new Map<string, WorkOrderRecord[]>();
  for (const w of records) {
    const k = keyFn(w);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }
  return Array.from(groups.entries())
    .map(([key, rs]) => {
      const excl = sum(rs.map((w) => w.billedValueExclGst));
      const incl = sum(rs.map((w) => w.billedValueInclGst));
      return {
        key,
        count: rs.length,
        // Primary sum follows amountType so "most billed excluding GST" ranks
        // by the excl-GST column; both are always present for transparency.
        billedValueSum: amountType === "excl_gst" ? excl : incl,
        billedValueExclGstSum: excl,
        billedValueInclGstSum: incl,
        amountReceivableSum: sum(rs.map((w) => w.amountReceivable)),
      };
    })
    .sort((a, b) => b.billedValueSum - a.billedValueSum || b.count - a.count);
}

function trimWorkOrder(w: WorkOrderRecord) {
  const rec: Record<string, unknown> = {
    name: w.name,
    customerCode: w.customerNameCode,
    sector: w.sector,
    executionStatus: w.executionStatus,
    billingStatus: w.billingStatus.canonical,
    billingStatusRaw: w.billingStatus.raw,
    woStatus: w.woStatusBilled,
    billedValueExclGst: w.billedValueExclGst,
    billedValueInclGst: w.billedValueInclGst,
    amountReceivable: w.amountReceivable,
    quantity: w.quantitiesAsPerPo,
    poLoiDate: w.poLoiDate.iso,
  };
  // Same Tender guard on the Work Orders board's Sector column.
  if (w.sector != null && /tender/i.test(w.sector)) rec.dataQualityNote = TENDER_NOTE;
  return rec;
}

// ---------------------------------------------------------------------------
// cross_board_lookup
// ---------------------------------------------------------------------------

const NAME_CAVEAT =
  "⚠️ Name-based match: the Deals and Work Orders boards share NO common ID (Deals use Client Code like COMPANY089; Work Orders use Customer Name Code like WOCOMPANY_002). The only shared field is the masked deal name, which repeats across unrelated records on BOTH boards. Treat these matches as approximate, not definitive.";

/**
 * If dealName is given: return matching records from both boards for that name.
 * If dealName is omitted: return a conversion overview — which deal names do /
 * don't appear on the Work Orders board (i.e. "converted" vs "not converted"),
 * with a sample of the unconverted. Either way the name caveat is embedded in
 * the tool's OWN response text so the model can't drop it.
 */
export async function crossBoardLookup(dealName?: string) {
  const { deals, workOrders } = await getBoards();

  if (dealName && dealName.trim() !== "") {
    const q = dealName.trim().toLowerCase();
    const dealMatches = deals.filter((d) => d.name.toLowerCase() === q);
    const woMatches = workOrders.filter((w) => w.name.toLowerCase() === q);
    return {
      mode: "single-name",
      caveat: NAME_CAVEAT,
      dealName,
      dealsBoard: {
        matchCount: dealMatches.length,
        records: dealMatches.map(trimDeal),
      },
      workOrdersBoard: {
        matchCount: woMatches.length,
        records: woMatches.map(trimWorkOrder),
      },
      interpretation:
        dealMatches.length > 0 && woMatches.length === 0
          ? "Appears on Deals but not Work Orders — MAY be an unconverted deal (name-based, so verify)."
          : dealMatches.length > 0 && woMatches.length > 0
          ? "Appears on both boards — MAY have converted to a work order (name-based, so verify)."
          : "No exact name match found on one or both boards.",
    };
  }

  // Overview mode — conversion analysis by name.
  const woNames = new Set(workOrders.map((w) => w.name.toLowerCase()));
  const dealNamesSeen = new Map<string, DealRecord[]>();
  for (const d of deals) {
    const k = d.name.toLowerCase();
    if (!dealNamesSeen.has(k)) dealNamesSeen.set(k, []);
    dealNamesSeen.get(k)!.push(d);
  }

  const unconverted: { name: string; stages: string[]; count: number; totalValue: number }[] = [];
  let convertedNameCount = 0;
  for (const [k, rs] of Array.from(dealNamesSeen.entries())) {
    if (woNames.has(k)) {
      convertedNameCount += 1;
    } else {
      unconverted.push({
        name: rs[0].name,
        stages: Array.from(new Set(rs.map((r: DealRecord) => r.dealStage.canonical))),
        count: rs.length,
        totalValue: sum(rs.map((r: DealRecord) => r.maskedDealValue)),
      });
    }
  }

  // Surface won/negotiation-stage unconverted first — most interesting.
  const priority = new Set(["Won", "Negotiation", "Proposal"]);
  unconverted.sort((a, b) => {
    const ap = a.stages.some((s) => priority.has(s)) ? 1 : 0;
    const bp = b.stages.some((s) => priority.has(s)) ? 1 : 0;
    return bp - ap || b.totalValue - a.totalValue;
  });

  return {
    mode: "conversion-overview",
    caveat: NAME_CAVEAT,
    overlap: crossBoardOverlap(deals, workOrders),
    distinctDealNames: dealNamesSeen.size,
    dealNamesConverted: convertedNameCount,
    dealNamesNotConverted: unconverted.length,
    unconvertedSample: unconverted.slice(0, 40),
  };
}

// ---------------------------------------------------------------------------
// get_data_quality_summary
// ---------------------------------------------------------------------------

export async function getDataQualitySummary() {
  const { deals, workOrders } = await getBoards();
  return {
    deals: summarizeDeals(deals),
    workOrders: summarizeWorkOrders(workOrders),
    crossBoard: crossBoardOverlap(deals, workOrders),
    guidance:
      "Use these real counts when stating caveats. Notable: many deals lack a recorded value; some Work Order PO quantities are unparseable (units mixed inconsistently); most Work Orders have a blank billing status.",
  };
}

// ---------------------------------------------------------------------------
// shared
// ---------------------------------------------------------------------------

function countBy<T>(records: T[], keyFn: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) {
    const k = keyFn(r);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
