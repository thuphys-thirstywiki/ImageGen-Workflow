"use client";

type Props = {
  title: string;
  prompt: string;
  onChange: (prompt: string) => void;
  onUse: () => void;
  disabled?: boolean;
};

export function ProposalCard({
  title,
  prompt,
  onChange,
  onUse,
  disabled,
}: Props) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h4 className="font-display text-xs text-[var(--ink)]">{title}</h4>
        <button
          type="button"
          onClick={onUse}
          disabled={disabled || !prompt.trim()}
          className="shrink-0 rounded-md bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
        >
          填入 Prompt
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        disabled={disabled}
        className="w-full resize-none rounded-lg border border-[var(--line)] bg-white/70 px-2.5 py-1.5 text-xs leading-relaxed text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-60"
      />
    </div>
  );
}
