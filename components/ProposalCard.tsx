"use client";

import type { Proposal } from "@/lib/types";

type Props = {
  title: string;
  prompt: string;
  kind?: Proposal["kind"];
  onChange: (prompt: string) => void;
  onUse: () => void;
  disabled?: boolean;
};

function kindLabel(kind?: Proposal["kind"]): string | null {
  if (kind === "refine") return "渐进改进";
  if (kind === "rework") return "大改一版";
  return null;
}

export function ProposalCard({
  title,
  prompt,
  kind,
  onChange,
  onUse,
  disabled,
}: Props) {
  const label = kindLabel(kind);
  const rows = Math.min(14, Math.max(6, Math.ceil(prompt.length / 42)));

  return (
    <div
      className={`rounded-xl border bg-[var(--surface)] p-3 shadow-sm ${
        kind === "rework"
          ? "border-[var(--ink)]/20"
          : "border-[var(--accent)]/30"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {label && (
            <span
              className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                kind === "rework"
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--accent)]/12 text-[var(--accent)]"
              }`}
            >
              {label}
            </span>
          )}
          <h4 className="font-display text-sm leading-snug text-[var(--ink)]">
            {title}
          </h4>
        </div>
        <button
          type="button"
          onClick={onUse}
          disabled={disabled || !prompt.trim()}
          className="shrink-0 rounded-md bg-[var(--ink)] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
        >
          填入 Prompt
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        disabled={disabled}
        className="w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-60"
      />
    </div>
  );
}
