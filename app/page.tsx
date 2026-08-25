import Link from "next/link";
import { AskIcon, ReasonIcon, DataIcon, DroneIcon, WaypointIcon } from "@/components/icons";

const FEATURES = [
  { Icon: AskIcon, title: "Ask", body: "Natural-language questions over pipeline, revenue, work orders and billing." },
  { Icon: ReasonIcon, title: "Reasoning", body: "See the flight path of tool calls behind every answer — nothing is a black box." },
  { Icon: DataIcon, title: "Data & Graphs", body: "Live board status, completeness and charts, straight from monday.com." },
];

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* faint survey/contour motif, top-right */}
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] opacity-[0.5]"
        viewBox="0 0 200 200"
        fill="none"
        stroke="var(--teal)"
        aria-hidden
      >
        {[70, 56, 42, 28].map((r, i) => (
          <ellipse key={r} cx="110" cy="90" rx={r} ry={r * 0.72} strokeOpacity={0.12 - i * 0.02} />
        ))}
        <path d="M20 150 L70 120 L100 132 L140 96 L182 108" strokeOpacity="0.28" strokeDasharray="3 4" />
        {[[70, 120], [140, 96]].map(([x, y]) => (
          <path key={x} d={`M${x} ${y - 6} L${x + 5} ${y + 5} L${x} ${y + 2} L${x - 5} ${y + 5} Z`} fill="var(--amber)" stroke="none" />
        ))}
      </svg>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 md:px-10">
        {/* top bar */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span className="text-[color:var(--teal)]">
              <DroneIcon width={22} height={22} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-[color:var(--ink)]">
              Skylark Survey Console
            </span>
          </div>
          <Link
            href="/console"
            className="u-meta rounded-md px-3 py-1.5 text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--teal-deep)]"
          >
            Launch console →
          </Link>
        </header>

        {/* hero */}
        <section className="flex flex-1 flex-col justify-center py-10">
          <span className="tick text-[color:var(--teal-deep)]">Aerial business intelligence</span>
          <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-[color:var(--ink)] md:text-[54px]">
            Your survey data,
            <br />
            answered in plain language.
          </h1>
          <p className="u-lead mt-6 max-w-xl">
            A conversational BI console for Skylark Drones. Ask about pipeline, revenue, work
            orders and billing across two live monday.com boards — and get an answer, not a
            spreadsheet. Every figure is computed from a real board read, never estimated by the
            model.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/console"
              className="flex items-center gap-2 rounded-lg bg-[color:var(--teal)] px-5 py-3 text-[14.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <WaypointIcon width={16} height={16} /> Launch the console
            </Link>
            <Link
              href="/console"
              className="rounded-lg px-4 py-3 text-[14px] text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--teal-deep)]"
            >
              See how it thinks →
            </Link>
          </div>

          {/* feature row */}
          <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <span className="text-[color:var(--teal)]">
                  <f.Icon width={19} height={19} />
                </span>
                <span className="text-[14.5px] font-semibold text-[color:var(--ink)]">{f.title}</span>
                <span className="u-meta leading-relaxed">{f.body}</span>
              </div>
            ))}
          </div>
        </section>

        {/* trust footer */}
        <footer className="border-t border-[color:var(--line-soft)] py-5">
          <p className="u-meta">
            Live monday.com data · Deals + Work Orders · figures computed server-side, never
            estimated · masked values.
          </p>
        </footer>
      </div>
    </main>
  );
}
