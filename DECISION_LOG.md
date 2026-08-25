# Decision Log — Skylark Survey Console

A conversational BI agent that answers founder questions by reading two live
monday.com boards (Deals, ~344 rows; Work Orders, ~176 rows). No board data
ships with the app — every figure comes from a monday.com API read at query time.

## Key assumptions

**"Revenue" is not one number.** The Work Orders board carries order value,
billed value and collected value as separate columns, each in ex-GST and
incl-GST form. "Revenue" defaults to **billed, ex-GST** — GST is a pass-through
tax collected for the government, not revenue — and the agent states that
assumption in one clause and names the alternatives (gross/incl-GST, and
pipeline deal value) when they matter. Deal value is explicitly *not* revenue.

**"Pipeline" means open pipeline.** Lead / Qualified / Proposal / Negotiation.
Won / Lost / On Hold / Irrelevant are excluded unless the user says otherwise.
The agent states this rather than asking, since it's the sensible default.

**"This year" is the calendar year to date.** Relative dates resolve against the
server's current date, stated in the answer. (Indian fiscal-year quarters are a
known follow-up — see below.)

**Masked deal names are not unique keys.** The same name (e.g. "Sakura") repeats
across unrelated rows on both boards. The boards also share no common ID — Deals
use `Client Code` (`COMPANY089`), Work Orders use `Customer Name Code`
(`WOCOMPANY_002`). Cross-board answers are therefore **name-based and
approximate**, and every cross-board answer carries that caveat (embedded in the
tool's own response so the model can't drop it).

**Missing data is reported, never imputed.** A null is never treated as zero.
Every aggregation returns how many rows were dropped for a blank metric, and the
answer cites it ("covers only the 165 deals with a recorded value — 52% have
none"). A total that quietly excludes half the rows is the exact failure mode
this design exists to prevent. A missing *value* is not a missing *record*: a
deal with no value is still listed by name/sector/owner.

**Known data artifacts are flagged, not silently kept.** "Tender" appears in the
sector column but is not a real sector — it's flagged wherever cited. The
`Billed`/`BIlled` mis-casing is canonicalized while keeping the raw label. The
messy `Quantities as per PO` field mixes numbers and units ("5360 HA", "40MW",
"NA"); the parser returns `{value, unit, raw, parseable}` and treats "NA" as
unparseable, not zero.

## Trade-offs

**Tool-calling agent, not text-to-SQL.** The model chooses which tools to run and
with what filters; the server does **all** counting and summing in plain
TypeScript (`lib/tools.ts`). The model copies figures verbatim and is forbidden
from computing, converting, or estimating any number. This costs flexibility (a
question the tools don't cover can't be improvised) and buys reproducibility — a
number can be wrong-*source* but never invented. For figures headed to a
leadership deck, that trade is worth it.

**Next.js over Streamlit.** One deployable unit, API keys stay server-side, and
the result reads as a product rather than a data-science demo. Costs more UI code.

**No agent framework.** The tool loop is ~80 lines and is the interesting part of
the problem. LangChain/CrewAI would add a large dependency to wrap it and make
the tool trace harder to expose. Multi-agent orchestration solves a problem this
doesn't have.

**A 60-second data cache.** One question can trigger several tool calls;
re-paginating both boards each time would make the app crawl. The cache makes one
turn = one live read while staying fresh within a minute. Still genuinely live —
never a hardcoded CSV.

**We built the charts.** Inline per-answer bar charts and a charted board report
(recharts), plus consistency checks that reconcile the board's *own* columns
against each other (does receivable = billed − collected? does balance quantity =
ordered − billed?). A wrong chart is a real risk, so charts are always computed
server-side from the same numbers the text uses and can't disagree with them.

**Confidence is per-query, not per-board.** Each answer's score reflects how
complete the *specific* field its figure is built from was, on the *rows it
actually used* — not the board's overall average. Asking about Lead-stage deal
value scores ~3% (almost none have a value); asking about Won deals scores ~65%.
This makes the score move with the question instead of sitting at a flat ~90%.

## How we interpreted "leadership updates"

As the artefact a founder would otherwise ask an analyst to assemble before a
meeting. Three concrete surfaces, each computed live:

- **Copy brief** on any answer — clean markdown carrying the question, the
  answer, its confidence, and the data caveats, timestamped and sourced.
- **Board report** (header + Data & Graphs) — a printable rollup: open pipeline
  by sector and stage, the ordered → billed → collected cash chain, execution
  status, billed-by-sector, and arithmetic consistency checks that surface real
  data-entry errors. Saves as PDF for a board meeting.
- **Export conversation** — a session summary (questions, waypoints, boards read,
  average confidence) plus the full transcript, as PDF or raw JSON.

The interpretation: the hard part isn't formatting, it's knowing which numbers
matter and being honest about which are shaky. Caveats are a required part of the
brief, not an afterthought.

## What we'd do differently with more time

- **Post-answer grounding check.** Match every figure in the finished prose back
  to a value a tool returned, and flag anything untraceable — catching a model
  that slips a decimal, beyond what the "server computes, model copies" rule
  already prevents.
- **Fiscal-year quarters.** "This quarter" currently resolves to calendar
  quarters; Indian FY (Apr–Mar) is the more likely founder intent.
- **Entity resolution for cross-board.** Fuzzy matching on client code + sector +
  value proximity would raise coverage beyond exact-name matching, with its own
  confidence exposed.
- **Persist the audit trail.** The tool trail is visible per answer but not
  stored; reopening a number weeks later and seeing the query behind it matters
  for a decision tool.
- **Value-level tests.** Current checks assert shape and that live reads succeed;
  the next step is asserting figures against independently computed expected
  values to catch a normaliser regression that still produces a plausible number.
