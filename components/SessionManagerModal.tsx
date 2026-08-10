"use client";

import type { SessionSummary } from "@/lib/types";
import { imageUrl } from "@/lib/client";

type Props = {
  open: boolean;
  sessions: SessionSummary[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  busy?: boolean;
};

export function SessionManagerModal({
  open,
  sessions,
  activeId,
  onClose,
  onSelect,
  onCreate,
  onDelete,
  busy,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-manager-title"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h3
              id="task-manager-title"
              className="font-display text-lg text-[var(--ink)]"
            >
              任务管理
            </h3>
            <p className="text-sm text-[var(--muted)]">
              新建、切换或删除设计任务
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            关闭
          </button>
        </div>

        <div className="border-b border-[var(--line)] px-5 py-3">
          <button
            type="button"
            onClick={onCreate}
            disabled={busy}
            className="w-full rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            新建设计任务
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-3">
          {sessions.length === 0 && (
            <li className="px-2 py-10 text-center text-sm text-[var(--muted)]">
              还没有任务
            </li>
          )}
          {sessions.map((session) => {
            const active = session.id === activeId;
            const thumb = imageUrl(session.latestImagePath);
            return (
              <li key={session.id} className="mb-1">
                <div
                  className={`group flex items-center gap-3 rounded-xl px-2 py-2 ${
                    active
                      ? "bg-[var(--surface-strong)] ring-1 ring-[var(--accent)]/30"
                      : "hover:bg-[var(--bg)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--canvas)]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted)]">
                          空
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--ink)]">
                        {session.title}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {session.iterationCount} 轮 ·{" "}
                        {new Date(session.updatedAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    {active && (
                      <span className="shrink-0 text-xs text-[var(--accent)]">
                        当前
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(session.id)}
                    className="rounded px-2 py-1 text-xs text-[var(--muted)] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    删除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
