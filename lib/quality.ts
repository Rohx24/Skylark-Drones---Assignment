// Data-quality summary — the normalization-issue counts, computed once and
// reused by both GET /api/health and the get_data_quality_summary agent tool.
// This is what lets the agent cite REAL caveats ("52% of deals have no value")
// instead of inventing vague ones.

import type { DealRecord, WorkOrderRecord } from "./types";

export function summarizeDeals(records: DealRecord[]) {
  const stageBreakdown: Record<string, number> = {};
  let unknownStage = 0;
  let missingValue = 0;
  let missingCreatedDate = 0;
  let missingTentativeClose = 0;
  let tenderFlagged = 0;
  let missingClientCode = 0;

  for (const r of records) {
    stageBreakdown[r.dealStage.canonical] =
      (stageBreakdown[r.dealStage.canonical] || 0) + 1;
    if (r.dealStage.canonical === "Unknown") unknownStage += 1;
    if (r.maskedDealValue == null) missingValue += 1;
    if (r.createdDate.iso == null) missingCreatedDate += 1;
    if (r.tentativeCloseDate.iso == null) missingTentativeClose += 1;
    if (r.sectorIsTender) tenderFlagged += 1;
    if (r.clientCode == null) missingClientCode += 1;
  }

  const count = records.length;
  return {
    count,
    issues: {
      unknownDealStage: unknownStage,
      missingDealValue: missingValue,
      missingDealValuePct: pct(missingValue, count),
      missingCreatedDate,
      missingTentativeCloseDate: missingTentativeClose,
      sectorIsTender_flagged: tenderFlagged,
      missingClientCode,
    },
    dealStageBreakdown: stageBreakdown,
  };
}

export function summarizeWorkOrders(records: WorkOrderRecord[]) {
  const billingBreakdown: Record<string, number> = {};
  const quantityUnitBreakdown: Record<string, number> = {};

  let unparseableQuantity = 0;
  let parseableQuantity = 0;
  let emptyQuantity = 0;
  let billingHadTypo = 0;
  let blankBilling = 0;
  let unmappedBilling = 0;
  let missingCustomerCode = 0;
  let missingAmountReceivable = 0;
  let missingPoDate = 0;

  for (const r of records) {
    billingBreakdown[r.billingStatus.canonical] =
      (billingBreakdown[r.billingStatus.canonical] || 0) + 1;
    if (r.billingStatus.canonical === "Blank") blankBilling += 1;
    else if (r.billingStatus.canonical === "Unknown") unmappedBilling += 1;
    if (r.billingStatus.raw && /BIlled/.test(r.billingStatus.raw)) billingHadTypo += 1;

    const q = r.quantitiesAsPerPo;
    if (q.raw.trim() === "") {
      emptyQuantity += 1;
    } else if (q.parseable) {
      parseableQuantity += 1;
      const unitKey = q.unit ? q.unit.toLowerCase() : "(no unit)";
      quantityUnitBreakdown[unitKey] = (quantityUnitBreakdown[unitKey] || 0) + 1;
    } else {
      unparseableQuantity += 1;
    }

    if (r.customerNameCode == null) missingCustomerCode += 1;
    if (r.amountReceivable == null) missingAmountReceivable += 1;
    if (r.poLoiDate.iso == null) missingPoDate += 1;
  }

  const count = records.length;
  return {
    count,
    issues: {
      quantity_parseable: parseableQuantity,
      quantity_unparseable: unparseableQuantity,
      quantity_empty: emptyQuantity,
      billingStatus_typo_BIlled_fixed: billingHadTypo,
      billingStatus_blank: blankBilling,
      billingStatus_unmapped: unmappedBilling,
      missingCustomerNameCode: missingCustomerCode,
      missingAmountReceivable,
      missingPoLoiDate: missingPoDate,
    },
    billingStatusBreakdown: billingBreakdown,
    quantityUnitBreakdown,
  };
}

/** Name-overlap between the two boards (approximate — names repeat). */
export function crossBoardOverlap(
  deals: DealRecord[],
  workOrders: WorkOrderRecord[]
) {
  const dealNames = new Set(deals.map((r) => r.name.toLowerCase()));
  const woNames = new Set(workOrders.map((r) => r.name.toLowerCase()));
  const shared = Array.from(woNames).filter((n) => dealNames.has(n)).length;
  return {
    note: "Name-based match only — masked deal names repeat across unrelated records on both boards, so this overlap is approximate.",
    distinctDealNames: dealNames.size,
    distinctWorkOrderNames: woNames.size,
    sharedDistinctNames: shared,
  };
}

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10; // one decimal
}
