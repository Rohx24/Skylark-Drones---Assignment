// Pure normalization functions for the messy monday.com data.
//
// Design rule: NEVER silently discard messiness. Every function returns the
// parsed result alongside the raw input so callers can audit or fall back.

import type {
  ParsedDate,
  ParsedDealStage,
  DealStageCanonical,
  ParsedQuantity,
  ParsedBillingStatus,
} from "./types";

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------

/**
 * Parse a monday date column's text into an ISO yyyy-mm-dd string.
 *
 * monday date columns expose `text` like "2024-03-15" and a JSON `value`
 * like {"date":"2024-03-15","time":null}. We accept either the plain text or
 * a couple of common human formats. Empty / whitespace / "NA" → null iso.
 */
export function parseDate(raw: string | null | undefined): ParsedDate {
  const rawStr = raw == null ? null : String(raw);
  if (rawStr == null) return { iso: null, raw: null };

  const trimmed = rawStr.trim();
  if (trimmed === "" || /^(na|n\/a|none|-)$/i.test(trimmed)) {
    return { iso: null, raw: rawStr };
  }

  // monday sometimes hands us the JSON value blob directly.
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj.date === "string") {
        return { iso: normalizeIso(obj.date), raw: rawStr };
      }
    } catch {
      // fall through to string parsing
    }
  }

  // Already ISO (yyyy-mm-dd, optionally with time).
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { iso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, raw: rawStr };
  }

  // dd/mm/yyyy or dd-mm-yyyy (Indian convention on these boards).
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    // Guard against obviously swapped values we can't disambiguate: if the
    // "month" part is > 12 but the "day" part is <= 12, swap them.
    let day = dd;
    let month = mm;
    if (Number(mm) > 12 && Number(dd) <= 12) {
      day = mm;
      month = dd;
    }
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return { iso: `${y}-${month}-${day}`, raw: rawStr };
    }
  }

  // Last resort: let Date try, but only accept sane years.
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const yr = parsed.getUTCFullYear();
    if (yr >= 1990 && yr <= 2100) {
      return { iso: parsed.toISOString().slice(0, 10), raw: rawStr };
    }
  }

  return { iso: null, raw: rawStr };
}

function normalizeIso(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ---------------------------------------------------------------------------
// canonicalizeDealStage
// ---------------------------------------------------------------------------

/**
 * Collapse the free-form / inconsistently-cased Deal Stage labels into a
 * fixed enum.
 *
 * The live board uses a lettered A–O pipeline ("A. Lead Generated",
 * "H. Work Order Received", …) plus a couple of unlettered labels. We map the
 * KNOWN labels explicitly (verified against the live board) so nothing real
 * lands in "Unknown", then fall back to keyword heuristics for any future /
 * unseen label.
 *
 * Post-win execution/billing stages (Work Order Received, Invoice sent, Amount
 * Accrued, Project Completed) all collapse to "Won" for pipeline win-rate
 * purposes — the Work Orders board carries the execution/billing detail.
 * Both "Not relevant" variants (N, O) mean dead/irrelevant. The stray literal
 * "Deal Stage" value (a leaked header) correctly stays "Unknown".
 */
const DEAL_STAGE_MAP: Record<string, DealStageCanonical> = {
  "lead generated": "Lead",
  "sales qualified leads": "Qualified",
  "demo done": "Qualified",
  feasibility: "Qualified",
  poc: "Qualified",
  "proposal/commercials sent": "Proposal",
  negotiations: "Negotiation",
  "project won": "Won",
  "work order received": "Won",
  "invoice sent": "Won",
  "amount accrued": "Won",
  "project completed": "Won",
  "project lost": "Lost",
  "projects on hold": "On Hold",
  "not relevant at the moment": "Irrelevant",
  "not relevant at all": "Irrelevant",
};

export function canonicalizeDealStage(raw: string | null | undefined): ParsedDealStage {
  const rawStr = raw == null ? null : String(raw);
  if (rawStr == null || rawStr.trim() === "") {
    return { canonical: "Unknown", raw: rawStr };
  }

  // Strip a leading "A." / "N." lettered prefix, collapse whitespace, lowercase.
  const s = rawStr
    .replace(/^[a-z]\.\s*/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  // Exact match against the known live-board label set first.
  if (DEAL_STAGE_MAP[s]) {
    return { canonical: DEAL_STAGE_MAP[s], raw: rawStr };
  }

  // Keyword fallback for anything not seen on the board yet.
  let canonical: DealStageCanonical = "Unknown";
  if (/not relevant|irrelevant|not interested|junk/.test(s)) {
    canonical = "Irrelevant";
  } else if (/\bwon\b|work order|invoice|accrued|completed|closed won/.test(s)) {
    canonical = "Won";
  } else if (/\blost\b|closed lost|deal lost|dead/.test(s)) {
    canonical = "Lost";
  } else if (/on hold|parked|paused/.test(s)) {
    canonical = "On Hold";
  } else if (/negotiat|contract|closing/.test(s)) {
    canonical = "Negotiation";
  } else if (/proposal|commercial|quote|quotation|pricing/.test(s)) {
    canonical = "Proposal";
  } else if (/qualif|discovery|demo|feasibility|poc|meeting/.test(s)) {
    canonical = "Qualified";
  } else if (/lead|prospect|inbound/.test(s)) {
    canonical = "Lead";
  }

  return { canonical, raw: rawStr };
}

// ---------------------------------------------------------------------------
// parseQuantity  (the "Quantities as per PO" mess)
// ---------------------------------------------------------------------------

/**
 * Parse the wildly inconsistent "Quantities as per PO" dropdown values, e.g.
 *   "5360 HA", "40MW", "2 location", "7 mines", "24 Months",
 *   "NA", "310.850" (thousands-comma-stripped), "L/s", "Rate based on MW slabs"
 *
 * Returns { value, unit, raw, parseable }. "NA" and clearly non-numeric
 * entries are unparseable (NOT zero) so aggregations can exclude them.
 */
export function parseQuantity(raw: string | null | undefined): ParsedQuantity {
  const rawStr = raw == null ? "" : String(raw);
  const trimmed = rawStr.trim();

  const unparseable: ParsedQuantity = {
    value: null,
    unit: null,
    raw: rawStr,
    parseable: false,
  };

  if (trimmed === "") return unparseable;

  // Explicit NA / not-applicable markers.
  if (/^(na|n\/a|none|nil|-|tbd|--)$/i.test(trimmed)) return unparseable;

  // Descriptive / rate-based entries with no leading number are unparseable
  // (e.g. "Rate based on MW slabs", "L/s", "NA . Verbal confirmation ...").
  // We still keep the raw string.
  //
  // Two number forms, comma-grouped tried first so "1, 310.850" isn't cut at
  // the "1". Commas MAY be followed by a stray space (the board has
  // "4, 875, 000.000"). The plain form uses \d+ so long integers like
  // "5360 HA" capture in full — the previous \d{1,3} cap truncated them to
  // 536 and shoved "0 HA" into the unit.
  const numMatch = trimmed.match(
    /^([+-]?\d+(?:,\s?\d{3})+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?)/
  );
  if (!numMatch) return unparseable;

  // Strip grouping commas (and any space after them), then parse.
  const numeric = Number(numMatch[1].replace(/,\s?/g, ""));
  if (!isFinite(numeric)) return unparseable;

  // Whatever follows the number is the unit (trimmed). Empty → null unit.
  let unit: string | null = trimmed.slice(numMatch[0].length).trim();
  if (unit === "") unit = null;
  else unit = unit.replace(/\s+/g, " ");

  return { value: numeric, unit, raw: rawStr, parseable: true };
}

// ---------------------------------------------------------------------------
// canonicalizeBillingStatus
// ---------------------------------------------------------------------------

/**
 * Fix the "BIlled" typo (wrong internal casing) and similar variants, mapping
 * everything onto a small canonical set while preserving the raw label.
 */
export function canonicalizeBillingStatus(
  raw: string | null | undefined
): ParsedBillingStatus {
  const rawStr = raw == null ? null : String(raw);
  if (rawStr == null || rawStr.trim() === "") {
    // Genuinely blank — the majority of Work Order rows. Distinguished from
    // "has a label we don't recognize" so metrics stay honest.
    return { canonical: "Blank", raw: rawStr };
  }

  const s = rawStr.trim().toLowerCase();

  let canonical = "Unknown";
  if (/partial/.test(s)) {
    canonical = "Partially Billed";
  } else if (/not\s*billable|non[- ]?billable/.test(s)) {
    // Won't be billed at all (distinct from "not yet billed").
    canonical = "Not Billable";
  } else if (/\bnot\s+billed\b|un\s*billed|to\s+be\s+billed|pending/.test(s)) {
    canonical = "Not Billed";
  } else if (/bill?ed|invoiced/.test(s)) {
    // Catches "Billed", "BIlled" (the mis-cased typo), "billed", "Invoiced".
    canonical = "Billed";
  } else if (/update\s*required/.test(s)) {
    canonical = "Update Required";
  } else if (/stuck|blocked/.test(s)) {
    canonical = "Stuck";
  } else if (/hold/.test(s)) {
    canonical = "On Hold";
  }

  return { canonical, raw: rawStr };
}

// ---------------------------------------------------------------------------
// Small shared helpers used by the board fetchers
// ---------------------------------------------------------------------------

/** Trim a column text to a non-empty string, else null. */
export function textOrNull(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  return t === "" ? null : t;
}

/** Parse a monday numbers column ("1,234.5" / "" ) into number | null. */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === "" || /^(na|n\/a|-)$/i.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return isFinite(n) ? n : null;
}
