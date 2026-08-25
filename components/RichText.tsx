// Minimal, dependency-free renderer for the agent's markdown-ish answers:
// **bold**, bullet lists (- / •), and ⚠️ caveat lines. Tuned to the shared
// type scale (.u-answer) — larger, airier prose for comfortable reading.
import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
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
    <div className="space-y-3.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l.trim()) || l.trim() === "");
        const isCaveat = /^\s*⚠️/.test(block) || /^\s*note:/i.test(block);

        if (isList && lines.some((l) => /^\s*[-•]/.test(l.trim()))) {
          return (
            <ul key={bi} className="space-y-2">
              {lines
                .filter((l) => l.trim() !== "")
                .map((l, li) => (
                  <li key={li} className="u-answer flex gap-3">
                    <span className="mt-[10px] h-[5px] w-[5px] shrink-0 rotate-45 bg-[color:var(--teal)]" />
                    <span>{renderInline(l.replace(/^\s*[-•]\s+/, ""))}</span>
                  </li>
                ))}
            </ul>
          );
        }

        if (isCaveat) {
          return (
            <p
              key={bi}
              className="u-body rounded-md bg-[color:var(--amber-soft)]/30 px-3.5 py-2.5 text-[color:var(--amber-deep)]"
            >
              {renderInline(block)}
            </p>
          );
        }

        return (
          <p key={bi} className="u-answer">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}
