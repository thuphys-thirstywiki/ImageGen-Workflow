"use client";

import { FormEvent, useEffect, useState } from "react";
import type { SessionSummary } from "@/lib/types";
import { imageUrl } from "@/lib/client";

const OWNER_NAME_KEY = "igw_owner_name";

type Props = {
  open: boolean;
  sessions: SessionSummary[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: {
    title: string;
    ownerName: string;
    description: string;
  }) => void | Promise<void>;
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
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setFormError(null);
    try {
      setOwnerName(localStorage.getItem(OWNER_NAME_KEY) || "");
    } catch {
      setOwnerName("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedOwner = ownerName.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedOwner || !trimmedDescription) {
      setFormError("请填写任务名称、使用者姓名和任务基本描述");
      return;
    }
    setFormError(null);
    try {
      localStorage.setItem(OWNER_NAME_KEY, trimmedOwner);
    } catch {
      // ignore quota / private mode
    }
    await onCreate({
      title: trimmedTitle,
      ownerName: trimmedOwner,
      description: trimmedDescription,
    });
  }

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

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-3 border-b border-[var(--line)] px-5 py-4"
        >
          <div>
            <label
              htmlFor="task-title"
              className="mb-1 block text-xs font-medium text-[var(--muted)]"
            >
              任务名称
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="例如：海报主视觉 v1"
              disabled={busy}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="task-owner"
              className="mb-1 block text-xs font-medium text-[var(--muted)]"
            >
              使用者姓名
            </label>
            <input
              id="task-owner"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              maxLength={40}
              placeholder="你的名字"
              disabled={busy}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="task-description"
              className="mb-1 block text-xs font-medium text-[var(--muted)]"
            >
              任务基本描述
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="说明目标受众、使用场景、风格约束、必含元素等。会写入生图与评审的模型上下文。"
              disabled={busy}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm leading-relaxed text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2 disabled:opacity-50"
            />
          </div>
          {formError && (
            <p className="text-xs text-red-600" role="alert">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            新建设计任务
          </button>
        </form>

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
                      {session.description ? (
                        <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--muted)]">
                          {session.description}
                        </div>
                      ) : null}
                      <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {session.ownerName || "未署名"} · {session.iterationCount}{" "}
                        轮 ·{" "}
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
