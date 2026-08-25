# Skylark Survey Console

A conversational business-intelligence agent for Skylark Drones. Founders ask
natural-language questions; the app answers by querying two **live** monday.com
boards via the GraphQL API — never from hardcoded CSV data. Every figure in
every answer is computed server-side from a real board read at query time.

Next.js 14 (App Router) · TypeScript · Tailwind · OpenAI tool-calling · Recharts.

**Live app:** _add your deployed URL here_ (see [Deploy](#deploy-vercel)).

---

## What it does

Ask a plain-English question about pipeline, revenue, work orders or billing.
The agent decides which tools to run, the **server** computes the figures, and
the answer comes back with caveats attached. Beyond the prose, each answer
carries:

- **Real tables & charts** — multi-record answers render as markdown tables;
  grouped breakdowns get an automatic inline bar chart.
- **A confidence score** — based on how complete the *specific* field the figure
  is built from was, on the rows actually used (not a board-wide average).
- **A reasoning trail** — the exact tool calls ("waypoints") behind the answer,
  with the board, filters and returned data, viewable inline or in a full tab.

Three "leadership update" surfaces: **Copy brief** (markdown, per answer),
**Board report** (printable PDF: pipeline by sector/stage, the ordered → billed →
collected cash chain, execution status, and arithmetic consistency checks), and
**Export conversation** (session summary + full transcript, PDF or JSON).

A first-visit guided tour points at each control; replay it anytime via the "?"
in the header.

## Architecture

```
Browser (chat UI)
  → POST /api/chat
     → runAgent()            lib/agent.ts   OpenAI chat-completions + function calling
        → tools              lib/tools.ts   ALL counting/summing, in plain TypeScript
           → data cache      lib/data.ts    60s in-memory cache (one turn = one live read)
              → monday client lib/monday.ts  paginates both boards over GraphQL
```

The split that matters: **the model chooses the tools; the server computes the
numbers.** Figures are summed in TypeScript and copied verbatim into the answer,
so a number can be wrong-source but never invented.

| Piece | Location |
|---|---|
| GraphQL client + paginated board fetchers | `lib/monday.ts` |
| Column-id maps, board IDs, typed record shapes | `lib/types.ts` |
| Pure normalizers (dates, stages, quantities, billing status) | `lib/normalize.ts` |
| Cached board access (60s TTL) | `lib/data.ts` |
| Agent tools: `query_deals`, `query_work_orders`, `cross_board_lookup`, `get_data_quality_summary` | `lib/tools.ts` |
| Data-quality summaries + cross-board overlap | `lib/quality.ts` |
| Board status, chart datasets, per-query confidence | `lib/insights.ts` |
| Board report (rollups + consistency checks) | `lib/report.ts` |
| Agent loop + system prompt | `lib/agent.ts` |
| Chat UI, reasoning panel, charts, report, export, tour | `components/*`, `app/console` |

**API routes:** `POST /api/chat` (agent), `GET /api/insights` (board status +
charts), `GET /api/report` (board report), `GET /api/health` (counts +
normalization issues), `POST /api/monday` (thin GraphQL passthrough).

## monday.com setup

1. **Import the two boards.** Import the Deals and Work Orders data as two
   separate boards. Set column types as you see fit — the app reads columns by
   the IDs recorded in `lib/types.ts` (`DEALS_BOARD_ID`, `WORK_ORDERS_BOARD_ID`
   and the `DEALS_COLUMNS` / `WORK_ORDER_COLUMNS` maps). If your board or column
   IDs differ, update those constants.
2. **Get a read-only API token.** monday.com → your avatar → **Administration →
   API** (or **Developers → My Access Tokens**). The app only ever reads.
3. **Configure env** (see below) with that token.

## Running locally

1. Install deps:
   ```bash
   npm install
   ```
2. Create `.env.local` from the example and fill it in:
   ```bash
   cp .env.local.example .env.local
   ```
   ```
   MONDAY_API_TOKEN=your_read_only_monday_token
   OPENAI_API_KEY=your_openai_key
   # optional — defaults to gpt-4o
   OPENAI_MODEL=gpt-4o
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Sanity-check the live pipeline:
   ```bash
   curl -s http://localhost:3000/api/health | jq
   ```
   Expect ~344 Deals and ~176 Work Orders items, plus a per-issue normalization
   summary. Then open <http://localhost:3000>.

## Deploy (Vercel)

1. Push this repo to GitHub (done) and import it in Vercel as a Next.js app.
2. In the Vercel project's **Settings → Environment Variables**, set
   `MONDAY_API_TOKEN` and `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`). Do
   **not** commit these — `.env*.local` is gitignored.
3. Deploy, then put the resulting URL at the top of this README.

## Data notes / gotchas

- **Deal names are not unique** and repeat across unrelated records on both
  boards.
- **Cross-board joins are name-based and approximate** — the boards share no
  common ID (`Client Code` vs `Customer Name Code`). Every cross-board answer
  carries that caveat.
- **~52% of deals have no recorded value** — value totals reflect only deals that
  do, and the answer says so.
- **`Sector/service` includes "Tender"**, which is not a real sector — it's
  flagged, not silently kept.
- **`Quantities as per PO`** mixes numbers and units inconsistently; `parseQuantity`
  returns `{value, unit, raw, parseable}` and treats "NA" as unparseable, not zero.
- **`Billing Status`** contains a "BIlled" typo, canonicalized while preserving
  the raw label.
- Normalizers **never discard the raw value** — every parsed result keeps its
  `raw` companion.

See [DECISION_LOG.md](DECISION_LOG.md) for assumptions, trade-offs, the
"leadership updates" interpretation, and what we'd do with more time.
