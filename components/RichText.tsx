// Renders the agent's markdown answers: paragraphs, bold, lists, ⚠️/Note
// caveats, and — via remark-gfm — real tables (with horizontal scroll on
// narrow screens). Tuned to the shared type scale (.u-answer).
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function textOf(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in (children as { props?: { children?: ReactNode } })) {
    return textOf((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-3.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            const t = textOf(children).trim();
            const isCaveat = /^⚠️/.test(t) || /^note:/i.test(t);
            if (isCaveat) {
              return (
                <p className="u-body rounded-md bg-[color:var(--amber-soft)]/30 px-3.5 py-2.5 text-[color:var(--amber-deep)]">
                  {children}
                </p>
              );
            }
            return <p className="u-answer">{children}</p>;
          },
          ul: ({ children }) => (
            <ul className="u-answer list-disc space-y-2 pl-5 marker:text-[color:var(--teal)]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="u-answer list-decimal space-y-2 pl-5 marker:text-[color:var(--ink-faint)]">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[color:var(--ink)]">{children}</strong>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-[color:var(--teal-deep)] underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="mono rounded bg-[color:var(--panel-inset)] px-1 py-0.5 text-[0.9em]">{children}</code>
          ),
          table: ({ children }) => (
            <div className="scroll-thin -mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => (
            <th className="tick whitespace-nowrap border-b border-[color:var(--line)] px-3 py-2 text-left text-[color:var(--ink-soft)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="whitespace-nowrap border-b border-[color:var(--line-soft)] px-3 py-2 text-[color:var(--ink)]">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
