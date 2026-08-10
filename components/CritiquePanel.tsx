"use client";

import type { Critique } from "@/lib/types";
import { ProposalCard } from "./ProposalCard";

type Props = {
  critique?: Critique;
  proposalDrafts: Record<string, string>;
  onProposalChange: (id: string, prompt: string) => void;
  onUseProposal: (prompt: string) => void;
  onCritiqueOnly: () => void;
  disabled?: boolean;
  hasImage?: boolean;
};

export function CritiquePanel({
  critique,
  proposalDrafts,
  onProposalChange,
  onUseProposal,
  onCritiqueOnly,
  disabled,
  hasImage,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <h2 className="font-display text-sm tracking-wide text-[var(--ink)]">
          VLM 评审与方案
        </h2>
        <button
          type="button"
          onClick={onCritiqueOnly}
          disabled={disabled || !hasImage}
          className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          仅重新评审
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!critique && (
          <p className="text-xs text-[var(--muted)]">
            提交后这里会出现评价、改进点与可编辑方案。
          </p>
        )}

        {critique && (
          <>
            <section>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                总体评价
              </h3>
              <p className="text-xs leading-relaxed text-[var(--ink)]">
                {critique.summary}
              </p>
            </section>

            {critique.improvements.length > 0 && (
              <section>
                <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                  改进建议
                </h3>
                <ul className="space-y-1">
                  {critique.improvements.map((item, index) => (
                    <li
                      key={`${index}-${item.slice(0, 12)}`}
                      className="flex gap-2 text-xs leading-relaxed text-[var(--ink)]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                设计方案
              </h3>
              {critique.proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  title={proposal.title}
                  prompt={proposalDrafts[proposal.id] ?? proposal.prompt}
                  onChange={(value) => onProposalChange(proposal.id, value)}
                  onUse={() =>
                    onUseProposal(
                      proposalDrafts[proposal.id] ?? proposal.prompt,
                    )
                  }
                  disabled={disabled}
                />
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
