// Minimal, dependency-free renderer for the agent's markdown-ish answers:
// **bold**, bullet lists (- / •), and ⚠️ caveat lines get map-appropriate
// styling. No external markdown lib, and text is treated as plain data.
import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  // Split on **bold** while keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[color:var(--ink)]">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l.trim()) || l.trim() === "");
        const isCaveat = /^\s*⚠️/.test(block) || /^\s*note:/i.test(block);

        if (isList && lines.some((l) => /^\s*[-•]/.test(l.trim()))) {
          return (
            <ul key={bi} className="space-y-1.5">
              {lines
                .filter((l) => l.trim() !== "")
                .map((l, li) => (
                  <li key={li} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-[color:var(--teal)]" />
                    <span>{renderInline(l.replace(/^\s*[-•]\s+/, ""))}</span>
                  </li>
                ))}
            </ul>
          );
        }

        return (
          <p
            key={bi}
            className={
              isCaveat
                ? "flex gap-2 rounded border-l-2 border-[color:var(--amber)] bg-[color:var(--amber-soft)]/40 px-3 py-2 text-[12.5px] leading-relaxed text-[color:var(--amber-deep)]"
                : "text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]"
            }
          >
            <span>{renderInline(block)}</span>
          </p>
        );
      })}
    </div>
  );
}
