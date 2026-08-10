"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CritiquePanel } from "@/components/CritiquePanel";
import { ImageStage } from "@/components/ImageStage";
import { IterationTimeline } from "@/components/IterationTimeline";
import { SessionManagerModal } from "@/components/SessionManagerModal";
import { apiJson } from "@/lib/client";
import type { Session, SessionSummary } from "@/lib/types";

type BusyKind = "idle" | "generate" | "critique" | "load";
type InputMode = "prompt" | "upload";

type PendingImage = {
  file: File;
  previewUrl: string;
};

export function Workbench() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [activeIterationId, setActiveIterationId] = useState<string | null>(
    null,
  );
  const [titleDraft, setTitleDraft] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("prompt");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [proposalDrafts, setProposalDrafts] = useState<Record<string, string>>(
    {},
  );
  const [busy, setBusy] = useState<BusyKind>("idle");
  const [error, setError] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeIteration = useMemo(() => {
    if (!session) return null;
    if (activeIterationId) {
      return (
        session.iterations.find((item) => item.id === activeIterationId) || null
      );
    }
    return session.iterations[session.iterations.length - 1] || null;
  }, [session, activeIterationId]);

  const activeIndex = useMemo(() => {
    if (!session || !activeIteration) return -1;
    return session.iterations.findIndex((item) => item.id === activeIteration.id);
  }, [session, activeIteration]);

  const isFirstRound = (session?.iterations.length ?? 0) === 0;

  const clearPendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const setImageFromFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("只能粘贴或放入图片文件");
      return;
    }
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    setPromptDraft("");
    setError(null);
  }, []);

  const refreshList = useCallback(async () => {
    const data = await apiJson<{ sessions: SessionSummary[] }>("/api/sessions");
    setSessions(data.sessions);
  }, []);

  const loadSession = useCallback(
    async (id: string) => {
      setBusy("load");
      setError(null);
      try {
        const data = await apiJson<{ session: Session }>(`/api/sessions/${id}`);
        setSession(data.session);
        setTitleDraft(data.session.title);
        const latest =
          data.session.iterations[data.session.iterations.length - 1];
        setActiveIterationId(latest?.id ?? null);
        const drafts: Record<string, string> = {};
        for (const iteration of data.session.iterations) {
          for (const proposal of iteration.critique?.proposals || []) {
            drafts[proposal.id] = proposal.prompt;
          }
        }
        setProposalDrafts(drafts);
        setPromptDraft("");
        clearPendingImage();
        setInputMode("prompt");
        setTaskModalOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setBusy("idle");
      }
    },
    [clearPendingImage],
  );

  useEffect(() => {
    void (async () => {
      try {
        await refreshList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载任务列表失败");
      }
    })();
  }, [refreshList]);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateSession() {
    setBusy("load");
    setError(null);
    try {
      const stamp = new Date().toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const created = await apiJson<{ session: Session }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: `新任务 ${stamp}` }),
      });
      setSession(created.session);
      setActiveIterationId(null);
      setTitleDraft(created.session.title);
      setPromptDraft("");
      clearPendingImage();
      setInputMode("prompt");
      setProposalDrafts({});
      setTaskModalOpen(false);
      await refreshList();
      requestAnimationFrame(() => promptRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy("idle");
    }
  }

  async function handleGenerate(prompt: string) {
    if (!session) {
      setError("请先通过「任务管理」新建或打开一个任务");
      setTaskModalOpen(true);
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("prompt 不能为空");
      return;
    }

    setBusy("generate");
    setError(null);
    setPromptDraft("");
    try {
      const endpoint =
        session.iterations.length === 0
          ? `/api/sessions/${session.id}/generate`
          : `/api/sessions/${session.id}/iterate`;
      const data = await apiJson<{ session: Session }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ prompt: trimmed }),
      });
      setSession(data.session);
      const latest = data.session.iterations[data.session.iterations.length - 1];
      setActiveIterationId(latest?.id ?? null);
      setInputMode("prompt");
      await refreshList();
    } catch (err) {
      setPromptDraft(trimmed);
      setError(err instanceof Error ? err.message : "生图失败");
    } finally {
      setBusy("idle");
    }
  }

  async function handleUploadAndCritique() {
    if (!session) {
      setError("请先通过「任务管理」新建或打开一个任务");
      setTaskModalOpen(true);
      return;
    }
    if (!pendingImage) {
      setError("请先选择图片");
      return;
    }

    const file = pendingImage.file;
    setBusy("critique");
    setError(null);
    clearPendingImage();

    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch(`/api/sessions/${session.id}/upload`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        session?: Session;
        error?: string;
      };
      if (!response.ok || !data.session) {
        throw new Error(data.error || `上传失败 (${response.status})`);
      }
      setSession(data.session);
      const latest = data.session.iterations[data.session.iterations.length - 1];
      setActiveIterationId(latest?.id ?? null);
      setInputMode("prompt");
      await refreshList();
    } catch (err) {
      setInputMode("upload");
      setImageFromFile(file);
      setError(err instanceof Error ? err.message : "上传评审失败");
    } finally {
      setBusy("idle");
    }
  }

  async function handleCritiqueOnly() {
    if (!session || !activeIteration) return;
    setBusy("critique");
    setError(null);
    try {
      const data = await apiJson<{ session: Session }>(
        `/api/sessions/${session.id}/critique`,
        {
          method: "POST",
          body: JSON.stringify({ iterationId: activeIteration.id }),
        },
      );
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "评审失败");
    } finally {
      setBusy("idle");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该任务及其全部图片？")) return;
    try {
      await apiJson(`/api/sessions/${id}`, { method: "DELETE" });
      if (session?.id === id) {
        setSession(null);
        setActiveIterationId(null);
        setTitleDraft("");
        setPromptDraft("");
        clearPendingImage();
      }
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  const isBusy = busy !== "idle";

  function handlePaste(event: React.ClipboardEvent) {
    if (!session || isBusy || inputMode !== "upload") return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          setImageFromFile(file);
        }
        break;
      }
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    if (!session || isBusy || inputMode !== "upload") return;
    const file = event.dataTransfer.files?.[0];
    if (file) setImageFromFile(file);
  }

  function switchInputMode(mode: InputMode) {
    if (mode === inputMode) return;
    setInputMode(mode);
    if (mode === "prompt") {
      clearPendingImage();
      requestAnimationFrame(() => promptRef.current?.focus());
    } else {
      setPromptDraft("");
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <header className="relative z-10 shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95">
        <div className="flex items-center justify-between gap-4 px-4 py-2 md:px-5">
          <div className="min-w-0">
            <p className="font-display text-base tracking-tight text-[var(--ink)]">
              ImageGen Workflow
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {session
                ? `${titleDraft} · ${session.iterations.length} 轮`
                : "Prompt → 生图 / 传图 → VLM 评审 → 再迭代"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTaskModalOpen(true)}
            disabled={busy === "load"}
            className="shrink-0 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            任务管理
          </button>
        </div>
      </header>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-1.5 text-sm text-red-700">
          {error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_300px] overflow-hidden">
        <aside className="min-h-0 overflow-hidden border-r border-[var(--line)]">
          <IterationTimeline
            iterations={session?.iterations ?? []}
            activeId={activeIteration?.id ?? null}
            onSelect={setActiveIterationId}
            loading={busy === "generate" || busy === "critique"}
            taskTitle={session ? titleDraft : undefined}
          />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface)]">
          <div className="min-h-0 flex-1 overflow-hidden">
            <ImageStage
              iteration={activeIteration}
              index={Math.max(activeIndex, 0)}
              loading={busy === "generate" || busy === "critique"}
              hasSession={Boolean(session)}
            />
          </div>

          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="mb-2 flex gap-1 rounded-lg bg-[var(--surface-strong)] p-1">
              <button
                type="button"
                disabled={!session || isBusy}
                onClick={() => switchInputMode("prompt")}
                className={`flex-1 rounded-md px-3 py-1 text-sm transition disabled:opacity-50 ${
                  inputMode === "prompt"
                    ? "bg-white font-medium text-[var(--ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                写 Prompt
              </button>
              <button
                type="button"
                disabled={!session || isBusy}
                onClick={() => switchInputMode("upload")}
                className={`flex-1 rounded-md px-3 py-1 text-sm transition disabled:opacity-50 ${
                  inputMode === "upload"
                    ? "bg-white font-medium text-[var(--ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                传图
              </button>
            </div>

            {inputMode === "prompt" ? (
              <div className="flex gap-2">
                <textarea
                  ref={promptRef}
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  rows={2}
                  disabled={isBusy || !session}
                  placeholder={
                    !session
                      ? "请先打开「任务管理」新建或切换任务"
                      : isFirstRound
                        ? "描述画面、风格、构图、文字元素…"
                        : "完整方案或修改建议…"
                  }
                  className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={isBusy || !session}
                  onClick={() => void handleGenerate(promptDraft)}
                  className="shrink-0 self-stretch rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {busy === "generate" ? "处理中…" : "提交并评审"}
                </button>
              </div>
            ) : (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className="outline-none"
              >
                {pendingImage ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingImage.previewUrl}
                      alt="待评审图片"
                      className="h-14 w-14 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--ink)]">
                        {pendingImage.file.name || "clipboard-image"} ·{" "}
                        {Math.round(pendingImage.file.size / 1024)} KB
                      </p>
                      <button
                        type="button"
                        onClick={clearPendingImage}
                        disabled={isBusy}
                        className="text-xs text-[var(--accent)] underline disabled:opacity-50"
                      >
                        移除
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy || !session}
                      onClick={() => void handleUploadAndCritique()}
                      className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      {busy === "critique" ? "处理中…" : "提交并评审"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!session || isBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-white px-3 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    选择 / 拖拽 / 粘贴图片
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setImageFromFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
            )}
          </div>
        </main>

        <aside className="min-h-0 overflow-hidden border-l border-[var(--line)] bg-[var(--surface)]">
          <CritiquePanel
            critique={activeIteration?.critique}
            proposalDrafts={proposalDrafts}
            onProposalChange={(id, prompt) =>
              setProposalDrafts((prev) => ({ ...prev, [id]: prompt }))
            }
            onUseProposal={(prompt) => {
              switchInputMode("prompt");
              setPromptDraft(prompt);
              requestAnimationFrame(() => promptRef.current?.focus());
            }}
            onCritiqueOnly={() => void handleCritiqueOnly()}
            disabled={isBusy}
            hasImage={Boolean(activeIteration)}
          />
        </aside>
      </div>

      <SessionManagerModal
        open={taskModalOpen}
        sessions={sessions}
        activeId={session?.id ?? null}
        onClose={() => setTaskModalOpen(false)}
        onSelect={(id) => void loadSession(id)}
        onCreate={() => void handleCreateSession()}
        onDelete={(id) => void handleDelete(id)}
        busy={isBusy}
      />
    </div>
  );
}
