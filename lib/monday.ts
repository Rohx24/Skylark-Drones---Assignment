// monday.com GraphQL client + typed board fetchers.
//
// All data comes live from the monday API — never from hardcoded CSV. The
// token is read from MONDAY_API_TOKEN (server-side only; never exposed to the
// client).

import {
  DEALS_BOARD_ID,
  WORK_ORDERS_BOARD_ID,
  DEALS_COLUMNS,
  WORK_ORDER_COLUMNS,
  type DealRecord,
  type WorkOrderRecord,
  type MondayItem,
  type MondayItemsPage,
} from "./types";
import {
  parseDate,
  parseNumber,
  parseQuantity,
  textOrNull,
  canonicalizeDealStage,
  canonicalizeBillingStatus,
} from "./normalize";

const MONDAY_ENDPOINT = "https://api.monday.com/v2";
const API_VERSION = "2024-01";
const PAGE_LIMIT = 100;

export interface MondayQueryResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
  error_message?: string;
}

/**
 * Low-level GraphQL client. Throws on network / GraphQL errors so callers can
 * surface a clear failure instead of silently returning empty data.
 */
export async function mondayQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new Error(
      "MONDAY_API_TOKEN is not set. Add it to .env.local (see README)."
    );
  }

  const res = await fetch(MONDAY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
    // Always hit the live API; never cache BI data.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`monday API HTTP ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as MondayQueryResult<T>;

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `monday GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }
  if (json.error_message) {
    throw new Error(`monday API error: ${json.error_message}`);
  }
  if (json.data === undefined) {
    throw new Error("monday API returned no data");
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

interface BoardItemsResponse {
  boards: {
    id: string;
    columns: { id: string; title: string }[];
    items_page: MondayItemsPage;
  }[];
}

interface NextItemsResponse {
  next_items_page: MondayItemsPage;
}

const FIRST_PAGE_QUERY = `
  query ($boardId: [ID!], $limit: Int!) {
    boards(ids: $boardId) {
      id
      columns {
        id
        title
      }
      items_page(limit: $limit) {
        cursor
        items {
          id
          name
          column_values {
            id
            text
            value
            type
          }
        }
      }
    }
  }
`;

const NEXT_PAGE_QUERY = `
  query ($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        id
        name
        column_values {
          id
          text
          value
          type
        }
      }
    }
  }
`;

interface BoardFetch {
  items: MondayItem[];
  /** column_id → column title, used to detect corrupted header-artifact rows. */
  titleById: Record<string, string>;
}

/** Fetch every item on a board (plus column titles), following cursors. */
async function fetchAllItems(boardId: string): Promise<BoardFetch> {
  const first = await mondayQuery<BoardItemsResponse>(FIRST_PAGE_QUERY, {
    boardId: [boardId],
    limit: PAGE_LIMIT,
  });

  const board = first.boards?.[0];
  if (!board) {
    throw new Error(`Board ${boardId} not found or not accessible with this token`);
  }

  const titleById: Record<string, string> = {};
  for (const col of board.columns ?? []) titleById[col.id] = col.title;

  const items: MondayItem[] = [...board.items_page.items];
  let cursor = board.items_page.cursor;

  // Safety cap on pages to avoid an accidental infinite loop.
  let guard = 0;
  while (cursor && guard < 100) {
    guard += 1;
    const next = await mondayQuery<NextItemsResponse>(NEXT_PAGE_QUERY, {
      cursor,
      limit: PAGE_LIMIT,
    });
    items.push(...next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  return { items, titleById };
}

/**
 * Detect a corrupted "duplicate header" row: one where a cell's value literally
 * equals its own column's title (e.g. the Deal Stage cell reads "Deal Stage").
 * These are spreadsheet-assembly artifacts, not real records. We treat any row
 * with even one such cell as a header artifact — real masked data never names a
 * status value after its own column. Generic name-like columns are exempted so
 * a legitimately-named item can't trip the guard.
 */
const HEADER_GUARD_EXEMPT = new Set(["name", "title"]);

function isHeaderArtifactRow(
  item: MondayItem,
  titleById: Record<string, string>
): boolean {
  for (const cv of item.column_values) {
    const title = titleById[cv.id];
    if (!title || HEADER_GUARD_EXEMPT.has(cv.id)) continue;
    const text = cv.text?.trim();
    if (text && text.toLowerCase() === title.trim().toLowerCase()) {
      return true;
    }
  }
  return false;
}

/** Build a { column_id → text } map for one item. */
function columnTextMap(item: MondayItem): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const cv of item.column_values) {
    map[cv.id] = cv.text;
  }
  return map;
}

// ---------------------------------------------------------------------------
// getDealsBoard
// ---------------------------------------------------------------------------

export interface DealsBoardResult {
  boardId: string;
  totalFetched: number;
  records: DealRecord[];
  /** Rows skipped because core fields (a usable name) were null. */
  skipped: number;
  /** Rows skipped as corrupted header-artifact rows (value == column title). */
  headerArtifactsSkipped: number;
}

export async function getDealsBoard(): Promise<DealsBoardResult> {
  const { items, titleById } = await fetchAllItems(DEALS_BOARD_ID);
  const records: DealRecord[] = [];
  let skipped = 0;
  let headerArtifactsSkipped = 0;

  for (const item of items) {
    const c = columnTextMap(item);
    const name = textOrNull(item.name);

    // Validate/skip rows with no usable name — the board isn't pristine.
    if (!name) {
      skipped += 1;
      continue;
    }

    // Skip corrupted "duplicate header" rows (a cell equal to its column title).
    if (isHeaderArtifactRow(item, titleById)) {
      headerArtifactsSkipped += 1;
      continue;
    }

    const sectorService = textOrNull(c[DEALS_COLUMNS.sectorService]);

    records.push({
      id: item.id,
      name,
      ownerCode: textOrNull(c[DEALS_COLUMNS.ownerCode]),
      clientCode: textOrNull(c[DEALS_COLUMNS.clientCode]),
      dealStatus: textOrNull(c[DEALS_COLUMNS.dealStatus]),
      closureProbability: textOrNull(c[DEALS_COLUMNS.closureProbability]),
      maskedDealValue: parseNumber(c[DEALS_COLUMNS.maskedDealValue]),
      tentativeCloseDate: parseDate(c[DEALS_COLUMNS.tentativeCloseDate]),
      createdDate: parseDate(c[DEALS_COLUMNS.createdDate]),
      dealStage: canonicalizeDealStage(c[DEALS_COLUMNS.dealStage]),
      productDeal: textOrNull(c[DEALS_COLUMNS.productDeal]),
      sectorService,
      sectorIsTender: sectorService != null && /tender/i.test(sectorService),
    });
  }

  return {
    boardId: DEALS_BOARD_ID,
    totalFetched: items.length,
    records,
    skipped,
    headerArtifactsSkipped,
  };
}

// ---------------------------------------------------------------------------
// getWorkOrdersBoard
// ---------------------------------------------------------------------------

export interface WorkOrdersBoardResult {
  boardId: string;
  totalFetched: number;
  records: WorkOrderRecord[];
  skipped: number;
  headerArtifactsSkipped: number;
}

export async function getWorkOrdersBoard(): Promise<WorkOrdersBoardResult> {
  const { items, titleById } = await fetchAllItems(WORK_ORDERS_BOARD_ID);
  const records: WorkOrderRecord[] = [];
  let skipped = 0;
  let headerArtifactsSkipped = 0;

  const W = WORK_ORDER_COLUMNS;

  for (const item of items) {
    const c = columnTextMap(item);
    const name = textOrNull(item.name);

    if (!name) {
      skipped += 1;
      continue;
    }

    if (isHeaderArtifactRow(item, titleById)) {
      headerArtifactsSkipped += 1;
      continue;
    }

    records.push({
      id: item.id,
      name,
      customerNameCode: textOrNull(c[W.customerNameCode]),
      serial: textOrNull(c[W.serial]),
      natureOfWork: textOrNull(c[W.natureOfWork]),
      executionStatus: textOrNull(c[W.executionStatus]),
      dataDeliveryDate: parseDate(c[W.dataDeliveryDate]),
      poLoiDate: parseDate(c[W.poLoiDate]),
      documentType: textOrNull(c[W.documentType]),
      probableStartDate: parseDate(c[W.probableStartDate]),
      probableEndDate: parseDate(c[W.probableEndDate]),
      bdKamPersonnelCode: textOrNull(c[W.bdKamPersonnelCode]),
      sector: textOrNull(c[W.sector]),
      typeOfWork: textOrNull(c[W.typeOfWork]),
      skylarkPlatform: textOrNull(c[W.skylarkPlatform]),
      lastInvoiceDate: parseDate(c[W.lastInvoiceDate]),
      latestInvoiceNo: textOrNull(c[W.latestInvoiceNo]),
      amountExclGst: parseNumber(c[W.amountExclGst]),
      amountInclGst: parseNumber(c[W.amountInclGst]),
      billedValueExclGst: parseNumber(c[W.billedValueExclGst]),
      billedValueInclGst: parseNumber(c[W.billedValueInclGst]),
      collectedAmountInclGst: parseNumber(c[W.collectedAmountInclGst]),
      toBeBilledExclGst: parseNumber(c[W.toBeBilledExclGst]),
      toBeBilledInclGst: parseNumber(c[W.toBeBilledInclGst]),
      amountReceivable: parseNumber(c[W.amountReceivable]),
      arPriority: textOrNull(c[W.arPriority]),
      quantityByOps: parseNumber(c[W.quantityByOps]),
      quantitiesAsPerPo: parseQuantity(c[W.quantitiesAsPerPo]),
      quantityBilled: parseNumber(c[W.quantityBilled]),
      balanceInQuantity: parseNumber(c[W.balanceInQuantity]),
      invoiceStatus: textOrNull(c[W.invoiceStatus]),
      expectedBillingMonth: textOrNull(c[W.expectedBillingMonth]),
      actualBillingMonth: textOrNull(c[W.actualBillingMonth]),
      actualCollectionMonth: textOrNull(c[W.actualCollectionMonth]),
      woStatusBilled: textOrNull(c[W.woStatusBilled]),
      collectionStatus: textOrNull(c[W.collectionStatus]),
      collectionDate: textOrNull(c[W.collectionDate]),
      billingStatus: canonicalizeBillingStatus(c[W.billingStatus]),
    });
  }

  return {
    boardId: WORK_ORDERS_BOARD_ID,
    totalFetched: items.length,
    records,
    skipped,
    headerArtifactsSkipped,
  };
}
