// Shared types for the Skylark BI agent.
//
// Every parsed value keeps its `raw` companion so that downstream code (and the
// eventual chat agent) can always inspect the original messiness instead of
// trusting a lossy normalization. See lib/normalize.ts for the parsers.

// ---------------------------------------------------------------------------
// Board IDs and column-id maps (verified against the live boards)
// ---------------------------------------------------------------------------

export const DEALS_BOARD_ID = "5030843288";
export const WORK_ORDERS_BOARD_ID = "5030843478";

export const DEALS_COLUMNS = {
  ownerCode: "color_mm6jx8xg", // status
  clientCode: "dropdown_mm6jyqs0", // dropdown — cross-board-ish join id (COMPANY089-style)
  dealStatus: "color_mm6jcx1e", // status: Open, On Hold, Dead, Won
  closeDateA: "date_mm6jyg54", // date — ALWAYS EMPTY, ignored
  closureProbability: "color_mm6jesp7", // status: Low/Medium/High
  maskedDealValue: "numeric_mm6jamj2", // numbers
  tentativeCloseDate: "date_mm6jhqcn", // date
  dealStage: "color_mm6jsg89", // status — needs casing/wording canonicalization
  productDeal: "color_mm6jaq2s", // status — freeform combos ("Service + Spectra")
  sectorService: "color_mm6jjpew", // status — includes bogus "Tender"
  createdDate: "date_mm6jf73y", // date
} as const;

export const WORK_ORDER_COLUMNS = {
  customerNameCode: "dropdown_mm6jggrr", // dropdown WOCOMPANY_NNN — WO-side join id
  serial: "dropdown_mm6j9pyv", // dropdown SDPLDEAL-NNN
  natureOfWork: "color_mm6jebps", // status
  executionStatus: "color_mm6jqmwj", // status
  dataDeliveryDate: "date_mm6j9gq0", // date
  poLoiDate: "date_mm6jzrte", // date
  documentType: "color_mm6j843j", // status
  probableStartDate: "date_mm6jq42m", // date
  probableEndDate: "date_mm6j7pdv", // date
  bdKamPersonnelCode: "color_mm6j2ntd", // status
  sector: "color_mm6j3w5q", // status
  typeOfWork: "color_mm6j6z42", // status — multi-value combos
  skylarkPlatform: "color_mm6jag1k", // status: SPECTRA/DMO/NONE/SPECTRA+DMO
  lastInvoiceDate: "date_mm6j8v1f", // date
  latestInvoiceNo: "dropdown_mm6jjx60", // dropdown
  amountExclGst: "numeric_mm6jvzn3", // numbers
  amountInclGst: "numeric_mm6jr674", // numbers
  billedValueExclGst: "numeric_mm6jb84y", // numbers
  billedValueInclGst: "numeric_mm6j4bz", // numbers
  collectedAmountInclGst: "numeric_mm6jthfw", // numbers
  toBeBilledExclGst: "numeric_mm6j5cq0", // numbers
  toBeBilledInclGst: "numeric_mm6jfp7", // numbers
  amountReceivable: "numeric_mm6js6kw", // numbers
  arPriority: "color_mm6jsjyw", // status: Priority / blank
  quantityByOps: "numeric_mm6jykef", // numbers
  quantitiesAsPerPo: "dropdown_mm6jbkpq", // dropdown — THE MESSY FIELD
  quantityBilled: "numeric_mm6jh2qt", // numbers
  balanceInQuantity: "numeric_mm6j93e2", // numbers
  invoiceStatus: "color_mm6jabpc", // status
  expectedBillingMonth: "text_mm6j48k4", // text
  actualBillingMonth: "color_mm6jhkxk", // status
  actualCollectionMonth: "text_mm6j6dxf", // text
  woStatusBilled: "color_mm6jxvg6", // status: Open/Closed
  collectionStatus: "text_mm6jem9", // text
  collectionDate: "text_mm6j6xe", // text
  billingStatus: "color_mm6jha7p", // status — "BIlled" typo needs canonicalization
} as const;

// ---------------------------------------------------------------------------
// Parsed-value shapes
// ---------------------------------------------------------------------------

/** A date parsed from a monday date column, keeping the raw string. */
export interface ParsedDate {
  iso: string | null; // ISO yyyy-mm-dd, or null if unparseable/empty
  raw: string | null;
}

/** Canonical Deal Stage enum plus the original label. */
export type DealStageCanonical =
  | "Lead"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost"
  | "Irrelevant"
  | "On Hold"
  | "Unknown";

export interface ParsedDealStage {
  canonical: DealStageCanonical;
  raw: string | null;
}

/** Result of parsing the messy "Quantities as per PO" field. */
export interface ParsedQuantity {
  value: number | null;
  unit: string | null;
  raw: string;
  parseable: boolean;
}

/** Canonical billing status plus the original label. */
export interface ParsedBillingStatus {
  canonical: string; // e.g. "Billed", "Not Billed", "Partially Billed", "Unknown"
  raw: string | null;
}

// ---------------------------------------------------------------------------
// Row shapes returned by the board fetchers
// ---------------------------------------------------------------------------

export interface DealRecord {
  id: string;
  name: string; // masked deal name — NOT unique
  ownerCode: string | null;
  clientCode: string | null; // COMPANY089-style
  dealStatus: string | null; // Open / On Hold / Dead / Won
  closureProbability: string | null; // Low/Medium/High
  maskedDealValue: number | null;
  tentativeCloseDate: ParsedDate;
  createdDate: ParsedDate;
  dealStage: ParsedDealStage;
  productDeal: string | null;
  sectorService: string | null;
  sectorIsTender: boolean; // flagged: "Tender" is not a real sector
}

export interface WorkOrderRecord {
  id: string;
  name: string; // masked deal name — NOT unique
  customerNameCode: string | null; // WOCOMPANY_NNN
  serial: string | null; // SDPLDEAL-NNN
  natureOfWork: string | null;
  executionStatus: string | null;
  dataDeliveryDate: ParsedDate;
  poLoiDate: ParsedDate;
  documentType: string | null;
  probableStartDate: ParsedDate;
  probableEndDate: ParsedDate;
  bdKamPersonnelCode: string | null;
  sector: string | null;
  typeOfWork: string | null;
  skylarkPlatform: string | null;
  lastInvoiceDate: ParsedDate;
  latestInvoiceNo: string | null;
  amountExclGst: number | null;
  amountInclGst: number | null;
  billedValueExclGst: number | null;
  billedValueInclGst: number | null;
  collectedAmountInclGst: number | null;
  toBeBilledExclGst: number | null;
  toBeBilledInclGst: number | null;
  amountReceivable: number | null;
  arPriority: string | null;
  quantityByOps: number | null;
  quantitiesAsPerPo: ParsedQuantity;
  quantityBilled: number | null;
  balanceInQuantity: number | null;
  invoiceStatus: string | null;
  expectedBillingMonth: string | null;
  actualBillingMonth: string | null;
  actualCollectionMonth: string | null;
  woStatusBilled: string | null; // Open / Closed
  collectionStatus: string | null;
  collectionDate: string | null;
  billingStatus: ParsedBillingStatus;
}

// ---------------------------------------------------------------------------
// Raw monday.com GraphQL response shapes
// ---------------------------------------------------------------------------

export interface MondayColumnValue {
  id: string;
  text: string | null;
  value: string | null; // JSON string
  type?: string;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

export interface MondayItemsPage {
  cursor: string | null;
  items: MondayItem[];
}
