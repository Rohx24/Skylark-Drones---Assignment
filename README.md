# skylark-bi-agent

A conversational business-intelligence agent for Skylark Drones. Founders ask
natural-language questions; the app answers by querying two **live** monday.com
boards via the GraphQL API — never from hardcoded CSV data.

Next.js 14 (App Router) · TypeScript · Tailwind · deployable to Vercel.

## Phase 1 (this milestone) — data pipeline only

| Piece | Location |
|---|---|
| GraphQL client `mondayQuery(query, variables)` | `lib/monday.ts` |
| `getDealsBoard()` / `getWorkOrdersBoard()` (paginated, typed) | `lib/monday.ts` |
| Column-id maps + record/typed shapes | `lib/types.ts` |
| Pure normalizers (`parseDate`, `canonicalizeDealStage`, `parseQuantity`, `canonicalizeBillingStatus`, …) | `lib/normalize.ts` |
| `POST /api/monday` (thin GraphQL passthrough) | `app/api/monday/route.ts` |
| `GET /api/health` (counts + normalization-issue summary) | `app/api/health/route.ts` |

Phase 2 (the chat UI and the OpenAI tool-calling agent) is **not** built yet.

## Setup

1. Install deps:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example and paste your **read-only** monday
   personal token (Administration → API):

   ```bash
   cp .env.local.example .env.local
   # then edit .env.local and set MONDAY_API_TOKEN=...
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Sanity-check the pipeline:

   ```bash
   curl -s http://localhost:3000/api/health | jq
   ```

   Expect ~346 Deals items and ~175 Work Orders items, plus a per-issue
   normalization summary.

## Data notes / gotchas

- **Deal names are not unique** — the item `name` (e.g. "Sakura") is a masked
  deal name reused across many unrelated records on both boards.
- **Cross-board joins are name-based and approximate.** Deals use `Client Code`
  (COMPANY089-style); Work Orders use `Customer Name Code` (WOCOMPANY_002-style).
  These ID schemes never match directly, so the only shared field is the
  (non-unique) name. Every cross-board answer must carry that caveat.
- **`Close Date (A)` on the Deals board is always empty** and is ignored.
- **`Sector/service` includes "Tender"**, which is not a real sector — it is
  flagged (`sectorIsTender`) rather than silently kept.
- **`Quantities as per PO`** is the messy field: values mix numbers and units
  inconsistently ("5360 HA", "40MW", "24 Months", "NA", "310.850",
  "Rate based on MW slabs"). `parseQuantity` returns
  `{ value, unit, raw, parseable }`; "NA" and non-numeric entries are
  **unparseable, not zero**.
- **`Billing Status`** contains a mis-cased "BIlled" typo; `canonicalizeBillingStatus`
  fixes it while preserving the raw label.
- Normalizers **never discard the raw value** — every parsed result keeps its
  `raw` companion.

## Deploy (Vercel)

Set `MONDAY_API_TOKEN` as an environment variable in the Vercel project
settings (do not commit it), then deploy as a standard Next.js app.
