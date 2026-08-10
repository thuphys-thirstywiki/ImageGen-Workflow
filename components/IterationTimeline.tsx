"use client";

import { useEffect, useRef } from "react";
import type { Iteration } from "@/lib/types";
import { imageUrl } from "@/lib/client";

type Props = {
  iterations: Iteration[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  taskTitle?: string;
};

export function IterationTimeline({
  iterations,
  activeId,
  onSelect,
  loading,
  taskTitle,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [iterations.length, loading]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2.5">
        <h2 className="font-display text-sm tracking-wide text-[var(--ink)]">
          迭代历史
        </h2>
        {taskTitle && (
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {taskTitle}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {iterations.length === 0 && !loading && (
          <p className="px-2 py-6 text-center text-sm text-[var(--muted)]">
            尚未提交轮次。在下方提交 Prompt 或传图后，这里会出现历史。
          </p>
        )}

        <ul className="space-y-1">
          {iterations.map((iteration, index) => {
            const active = iteration.id === activeId;
            const src = imageUrl(iteration.imagePath);
            return (
              <li key={iteration.id}>
                <button
                  type="button"
                  onClick={() => onSelect(iteration.id)}
                  className={`flex w-full gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                    active
                      ? "bg-[var(--surface-strong)] ring-1 ring-[var(--accent)]/35"
                      : "hover:bg-[var(--bg)]"
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--canvas)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[var(--ink)]">
                        第 {index + 1} 轮
                      </span>
                      {iteration.source === "upload" && (
                        <span className="rounded bg-white px-1 py-0.5 text-[10px] text-[var(--muted)] ring-1 ring-[var(--line)]">
                          上传
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--muted)]">
                      {iteration.prompt}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}

          {loading && (
            <li className="rounded-lg border border-dashed border-[var(--accent)]/40 px-3 py-3 text-xs text-[var(--accent)]">
              正在提交并评审…
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>
    </div>
  );
}
