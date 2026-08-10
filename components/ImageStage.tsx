"use client";

import type { Iteration } from "@/lib/types";
import { imageUrl } from "@/lib/client";

type Props = {
  iteration: Iteration | null;
  index: number;
  loading?: boolean;
  hasSession?: boolean;
};

export function ImageStage({
  iteration,
  index,
  loading,
  hasSession,
}: Props) {
  const src = imageUrl(iteration?.imagePath);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--canvas)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 20%, rgba(13,115,119,0.14), transparent 42%), radial-gradient(circle at 82% 12%, rgba(196,149,74,0.10), transparent 38%), linear-gradient(160deg, #e8ecf0, #f5f7f9 55%, #e7ece9)",
        }}
      />

      <div className="relative z-[1] flex shrink-0 items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <div className="font-display text-sm text-[var(--ink)]">
            {iteration ? `第 ${index + 1} 轮成图` : "成图"}
          </div>
          {iteration && (
            <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {iteration.prompt}
            </div>
          )}
        </div>
        {loading && (
          <span className="shrink-0 animate-pulse text-xs text-[var(--accent)]">
            处理中…
          </span>
        )}
      </div>

      <div className="relative z-[1] flex min-h-0 flex-1 items-center justify-center p-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={iteration ? `第 ${index + 1} 轮` : "成图"}
            className="max-h-full max-w-full object-contain shadow-[0_24px_60px_-32px_rgba(20,30,40,0.5)]"
          />
        ) : (
          <p className="max-w-sm px-4 text-center text-sm text-[var(--muted)]">
            {!hasSession
              ? "请先通过「任务管理」新建或打开一个任务"
              : "在下方提交 Prompt 或传图后，这里显示当前选中轮次的成图"}
          </p>
        )}
      </div>
    </div>
  );
}
