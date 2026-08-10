"use client";

import type { Critique, Proposal } from "@/lib/types";
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

function sortProposals(proposals: Proposal[]): Proposal[] {
  const rank = (kind?: Proposal["kind"]) =>
    kind === "refine" ? 0 : kind === "rework" ? 1 : 2;
  return [...proposals].sort((a, b) => rank(a.kind) - rank(b.kind));
}

export function CritiquePanel({
  critique,
  proposalDrafts,
  onProposalChange,
  onUseProposal,
  onCritiqueOnly,
  disabled,
  hasImage,
}: Props) {
  const proposals = critique ? sortProposals(critique.proposals) : [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <div>
          <h2 className="font-display text-sm tracking-wide text-[var(--ink)]">
            改进与方案
          </h2>
          <p className="text-[11px] text-[var(--muted)]">
            以可执行改进为主，评价仅作参考
          </p>
        </div>
        <button
          type="button"
          onClick={onCritiqueOnly}
          disabled={disabled || !hasImage}
          className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          仅重新评审
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {!critique && (
          <p className="text-sm text-[var(--muted)]">
            提交后这里会给出改进建议，以及「渐进改进 / 大改」两类可编辑方案。
          </p>
        )}

        {critique && (
          <>
            {critique.improvements.length > 0 && (
              <section className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.04] p-3">
                <h3 className="mb-2 font-display text-sm text-[var(--ink)]">
                  改进建议
                </h3>
                <ol className="space-y-2.5">
                  {critique.improvements.map((item, index) => (
                    <li
                      key={`${index}-${item.slice(0, 12)}`}
                      className="flex gap-2.5 text-sm leading-relaxed text-[var(--ink)]"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap">
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="space-y-3">
              <div>
                <h3 className="font-display text-sm text-[var(--ink)]">
                  下一轮方案
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                  可编辑后点「填入 Prompt」；含渐进改进与大改方向
                </p>
              </div>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  title={proposal.title}
                  kind={proposal.kind}
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

            {critique.summary.trim() && (
              <section className="border-t border-[var(--line)] pt-3">
                <h3 className="mb-1 text-[11px] font-medium text-[var(--muted)]">
                  简要评价
                </h3>
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  {critique.summary}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
