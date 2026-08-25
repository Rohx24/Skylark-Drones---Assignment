// The conversational BI agent: OpenAI chat-completions with function calling,
// wired to the four tools in lib/tools.ts. Runs the tool loop server-side and
// returns the final answer plus a trace of which tools were called (so the UI
// can prove the tool-calling is real).

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import {
  queryDeals,
  queryWorkOrders,
  crossBoardLookup,
  getDataQualitySummary,
} from "./tools";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const MAX_TOOL_ROUNDS = 6;

export const SYSTEM_PROMPT = `You are a founder-facing business analyst for Skylark Drones. You answer natural-language business-intelligence questions by querying two live monday.com boards through your tools: a Deals (sales pipeline) board and a Work Orders (execution + billing) board.

HARD RULES:
1. NEVER fabricate OR mis-scope numbers. Every figure in your answer must be copied verbatim from a tool result — never compute, sum, convert, or estimate one yourself (including GST conversions between excl and incl). If you didn't get it from a tool, don't state it. If a tool returned no data, say so.
   1a. SCOPE DISCIPLINE: figures about a specific sector/group MUST come from THAT group's row in groupBreakdown (each row has its own billedValueExclGstSum and billedValueInclGstSum). The top-level 'amounts' object is the GRAND TOTAL across ALL groups combined — only cite it when talking about the whole filtered set, NEVER as a single group's figure. When you present a primary figure and a GST-alternative for the SAME entity, BOTH must come from the SAME row/scope (e.g. Renewables' excl AND Renewables' incl from the Renewables row) — never pair a per-group figure with the grand total.
2. When a request is genuinely AMBIGUOUS with NO sensible default, ASK ONE concise clarifying question instead of guessing. But when a reasonable default clearly applies, DON'T ask — state the assumption in one clause and answer. Guide:
   - "pipeline" → DEFAULT to OPEN pipeline (Lead, Qualified, Proposal, Negotiation). State that assumption and answer; only ask if the user hints they mean something broader. Do NOT hard-clarify this.
   - "this year" / date ranges → DEFAULT to the calendar year to date (state it). Only clarify calendar vs Indian fiscal year (Apr–Mar) if the two would give materially different answers AND it matters.
   - "biggest opportunity" / "best" / vague superlatives with NO obvious metric → ASK: largest deal value? highest closure probability? furthest-along stage? (This one has no sensible default — clarify it.)
   Never ask more than one clarifying question at a time.
   IMPORTANT: "opportunity", "deal", and "pipeline" are NOT pipeline stages. When ranking for "biggest/best opportunity", do NOT add a stage filter unless the user explicitly named a stage — rank across ALL stages by the requested metric (the query_deals sample is pre-sorted by closure probability then value, so the top row is your answer).
3. Cite DATA-QUALITY caveats INLINE whenever they materially affect the answer. Use real counts from your tools (query results include missing-value counts and percentages; get_data_quality_summary has the full picture). Example: "This total covers only the 165 deals with a recorded value — 52% of deals have none, so the real figure is higher."
4. For any CROSS-BOARD question (linking deals to work orders), ALWAYS state the name-matching caveat: the boards share no common ID, so matches are by masked deal name only, which repeats across unrelated records — approximate, not definitive. The cross_board_lookup tool returns this caveat text; surface it.
5. "Revenue" is ambiguous between pipeline value (Deals board 'deal value', which is masked) and actual billing (Work Orders 'billed'/'collected'). Deal value is NOT revenue. When the user says "revenue", DEFAULT to Work Orders billing EXCLUDING GST (amountType 'excl_gst') — GST is a pass-through tax collected for the government, not revenue — and state that assumption in one clause ("actual billed revenue, ex-GST"). In one further line, flag the two alternatives the user might have meant: the GST-inclusive/gross figure, and pipeline deal value (caveat: ~52% of deals have no recorded value). Keep it to those brief lines.
6. LIST COMPLETENESS: For "what/which" questions that return multiple matching records, NAME every matching record individually — use the records in the tool result's 'sample' array, with whatever fields ARE populated (sector, owner, stage). A missing VALUE is NOT a missing record: the deal's name/sector/owner are still known and useful. NEVER drop a record from the list just because its value/amount is null — instead write "value not recorded" inline next to that record. Only collapse into a summary sentence ("N records, none with a recorded value") when the list is genuinely long (roughly more than 15-20 records) or when 'count' exceeds the number of records in 'sample' (then say you're listing the first N of count). For a small result set like 4 deals, enumerate all four.

STYLE: Lead with the direct answer (a number or a short verdict). Then the key supporting detail. Then caveats. Be concise and founder-appropriate — no walls of text, no restating the question. Use short paragraphs or tight bullet lists. Round large masked numbers sensibly and note they're masked.

CANONICAL DEAL STAGES: Lead, Qualified, Proposal, Negotiation, Won, Lost, On Hold, Irrelevant. "Open pipeline" normally means the in-progress stages (Lead, Qualified, Proposal, Negotiation) — Won/Lost/Irrelevant/On Hold are not open. "Won" includes post-sale stages (work order received, invoiced, completed).`;

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "query_deals",
      description:
        "Query the Deals (sales pipeline) board with optional filters and aggregation. Returns count, deal-value aggregates (with missing-value counts you MUST cite), a stage breakdown, an optional groupBy breakdown, and a sample of records. All filtering is done server-side over live data.",
      parameters: {
        type: "object",
        properties: {
          sector: { type: "string", description: "Sector/service substring, e.g. 'mining' (case-insensitive). Note: 'Tender' is not a real sector." },
          stage: {
            type: "string",
            description: "Canonical stage bucket (exact): Lead, Qualified, Proposal, Negotiation, Won, Lost, On Hold, Irrelevant, Unknown. ONLY set this when the user explicitly names a pipeline stage. Do NOT infer a stage from words like 'opportunity', 'deal', or 'pipeline' — 'opportunity' is not the Lead stage.",
            enum: ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost", "On Hold", "Irrelevant", "Unknown"],
          },
          owner: { type: "string", description: "Owner code substring." },
          clientCode: { type: "string", description: "Client code substring, e.g. 'COMPANY089'." },
          closureProbability: { type: "string", description: "Closure probability: High, Medium, or Low. The returned sample is sorted by probability (then value), so the top rows are the strongest opportunities." },
          createdFrom: { type: "string", description: "ISO date lower bound on Created Date (yyyy-mm-dd)." },
          createdTo: { type: "string", description: "ISO date upper bound on Created Date." },
          closeFrom: { type: "string", description: "ISO date lower bound on Tentative Close Date." },
          closeTo: { type: "string", description: "ISO date upper bound on Tentative Close Date." },
          groupBy: { type: "string", enum: ["sector", "stage", "owner", "clientCode"], description: "Return per-group counts and value sums." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_work_orders",
      description:
        "Query the Work Orders (execution + billing) board with optional filters and aggregation. Returns count, rupee amount aggregates (billed/collected/receivable, masked), billing-status and execution-status breakdowns, an optional groupBy breakdown, and a sample.",
      parameters: {
        type: "object",
        properties: {
          sector: { type: "string", description: "Sector substring (case-insensitive)." },
          executionStatus: { type: "string", description: "Execution status substring." },
          billingStatus: {
            type: "string",
            description: "Canonical billing status (exact): Billed, Partially Billed, Not Billed, Not Billable, Update Required, Stuck, On Hold, Blank, Unknown.",
          },
          customerCode: { type: "string", description: "Customer Name Code substring, e.g. 'WOCOMPANY_002'." },
          woStatus: { type: "string", description: "WO Status (billed): 'Open' or 'Closed'." },
          amountType: {
            type: "string",
            enum: ["excl_gst", "incl_gst"],
            description: "Which Billed Value the primary sum uses. Default is 'excl_gst' (GST is a pass-through tax, not revenue). Set 'incl_gst' only when the user explicitly wants the GST-inclusive / gross figure. The result returns BOTH sums regardless, plus billedValueSum for the chosen type.",
          },
          dateField: { type: "string", enum: ["poLoiDate", "dataDeliveryDate", "probableStartDate", "probableEndDate", "lastInvoiceDate"], description: "Which date column the date range applies to (default poLoiDate)." },
          dateFrom: { type: "string", description: "ISO date lower bound." },
          dateTo: { type: "string", description: "ISO date upper bound." },
          groupBy: { type: "string", enum: ["sector", "billingStatus", "executionStatus", "customerCode", "woStatus"], description: "Return per-group counts and amount sums." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cross_board_lookup",
      description:
        "Link the two boards by masked deal name. With a dealName: returns matching records from BOTH boards for that name. WITHOUT a dealName: returns a conversion overview — which deal names do/don't appear on the Work Orders board (approximate 'converted vs not converted'), with a prioritized sample of unconverted deals. ALWAYS returns a name-matching caveat which you MUST surface.",
      parameters: {
        type: "object",
        properties: {
          dealName: { type: "string", description: "Masked deal name to look up (e.g. 'Sakura'). Omit for the whole-board conversion overview." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_data_quality_summary",
      description:
        "Returns the real normalization-issue counts from both boards (missing deal values, unparseable PO quantities, blank billing statuses, unknown stages, cross-board name overlap). Use it to cite accurate caveats instead of vague ones.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "query_deals":
      return queryDeals(args as Parameters<typeof queryDeals>[0]);
    case "query_work_orders":
      return queryWorkOrders(args as Parameters<typeof queryWorkOrders>[0]);
    case "cross_board_lookup":
      return crossBoardLookup(args.dealName as string | undefined);
    case "get_data_quality_summary":
      return getDataQualitySummary();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export interface ChartSeries {
  dimension: string; // what the groups are (sector, stage, …)
  metric: string; // what the bars measure ("billed ex-GST", "deals", …)
  unit: "currency" | "count";
  points: { label: string; value: number }[];
}

export interface ToolTraceEntry {
  name: string;
  arguments: Record<string, unknown>;
  resultPreview: string;
  /** Un-truncated, chart-ready series when the tool grouped by a dimension. */
  chart?: ChartSeries;
}

/**
 * Build a compact chart series from a FULL tool result (not the truncated
 * preview) when it grouped by a categorical dimension with 3+ groups. The
 * numbers are taken verbatim from the same groupBreakdown the answer used, so
 * an inline chart can never disagree with the text.
 */
function extractChart(
  name: string,
  args: Record<string, unknown>,
  result: unknown
): ChartSeries | undefined {
  const r = result as { groupBreakdown?: unknown; amountTypeUsed?: string };
  const gb = r?.groupBreakdown;
  if (!Array.isArray(gb) || gb.length < 3) return undefined;

  const groupBy = typeof args.groupBy === "string" ? args.groupBy : "group";

  // Choose the metric that the answer for this (tool, groupBy) actually leads
  // with, so bars match the typed numbers.
  let metric = "records";
  let unit: "currency" | "count" = "count";
  let valueOf: (row: Record<string, number>) => number = (row) => row.count ?? 0;

  if (name === "query_work_orders" && (groupBy === "sector" || groupBy === "customerCode")) {
    const excl = r.amountTypeUsed !== "incl_gst";
    metric = `billed (${excl ? "ex-GST" : "incl-GST"})`;
    unit = "currency";
    valueOf = (row) => row.billedValueSum ?? 0;
  } else if (name === "query_deals" && (groupBy === "sector" || groupBy === "clientCode")) {
    // Sector/client comparisons on Deals lead with pipeline value when present.
    const hasValue = (gb as Record<string, number>[]).some((row) => (row.valueSum ?? 0) > 0);
    if (hasValue) {
      metric = "deal value";
      unit = "currency";
      valueOf = (row) => row.valueSum ?? 0;
    } else {
      metric = "deals";
    }
  } else if (name === "query_deals") {
    metric = "deals"; // stage / owner → counts
  }

  const points = (gb as Record<string, number>[])
    .map((row) => ({
      label: String((row as unknown as { key: string }).key),
      value: Math.round(valueOf(row)),
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (points.length < 3 || !points.some((p) => p.value !== 0)) return undefined;

  return { dimension: groupBy, metric, unit, points };
}

export interface AgentResult {
  content: string;
  toolTrace: ToolTraceEntry[];
  model: string;
}

export interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runAgent(history: IncomingMessage[]): Promise<AgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env.local.");
  }
  const client = new OpenAI({ apiKey });

  const today = new Date().toISOString().slice(0, 10);
  const systemContent = `${SYSTEM_PROMPT}\n\nToday's date is ${today}. Resolve all relative time expressions ("this year", "this quarter", "last month", "recent") against this date. Never guess a year.`;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ];

  const toolTrace: ToolTraceEntry[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = completion.choices[0].message;
    messages.push(choice);

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { content: choice.content ?? "", toolTrace, model: MODEL };
    }

    // Execute every requested tool call, append results, loop again.
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      let result: unknown;
      try {
        result = await dispatch(call.function.name, args);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "tool error" };
      }

      const serialized = JSON.stringify(result);
      toolTrace.push({
        name: call.function.name,
        arguments: args,
        resultPreview: serialized.length > 600 ? serialized.slice(0, 600) + "…" : serialized,
        chart: extractChart(call.function.name, args, result),
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: serialized,
      });
    }
  }

  // Ran out of rounds — ask the model for a final answer without more tools.
  const finalCompletion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      ...messages,
      {
        role: "system",
        content:
          "Tool budget exhausted. Answer now using only the tool results already gathered. Do not invent numbers.",
      },
    ],
  });
  return {
    content: finalCompletion.choices[0].message.content ?? "",
    toolTrace,
    model: MODEL,
  };
}
