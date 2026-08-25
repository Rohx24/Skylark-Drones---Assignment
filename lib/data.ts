// Cached access to the two live boards.
//
// The data is small and changes slowly, but a single chat turn can trigger
// several tool calls — refetching both boards each time would make the demo
// crawl (a cold fetch is ~5-7s). We cache the parsed records in-module with a
// short TTL so one turn reuses one live fetch, while still being "live" (never
// hardcoded CSV, and it refreshes within a minute).

import { getDealsBoard, getWorkOrdersBoard } from "./monday";
import type { DealRecord, WorkOrderRecord } from "./types";

export interface Boards {
  deals: DealRecord[];
  workOrders: WorkOrderRecord[];
  fetchedAt: number;
}

const TTL_MS = 60_000;
let cache: Boards | null = null;
let inflight: Promise<Boards> | null = null;

/** Fetch both boards (from cache when fresh). Set force=true to bypass. */
export async function getBoards(force = false): Promise<Boards> {
  if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache;
  }
  // De-dupe concurrent callers within the same turn onto one fetch.
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const [deals, workOrders] = await Promise.all([
      getDealsBoard(),
      getWorkOrdersBoard(),
    ]);
    cache = {
      deals: deals.records,
      workOrders: workOrders.records,
      fetchedAt: Date.now(),
    };
    return cache;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
