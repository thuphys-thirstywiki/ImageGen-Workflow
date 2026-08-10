"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CritiquePanel } from "@/components/CritiquePanel";
import { ImageStage } from "@/components/ImageStage";
import { IterationTimeline } from "@/components/IterationTimeline";
import { SessionManagerModal } from "@/components/SessionManagerModal";
import { apiJson } from "@/lib/client";
import type { Session, SessionSummary } from "@/lib/types";

type BusyKind = "generate" | "critique" | "load";
type InputMode = "prompt" | "upload";

type PendingImage = {
  file: File;
  previewUrl: string;
};

type PendingResult = {
  session: Session;
  iterationId?: string | null;
};

function jobLabel(kind: BusyKind): string {
  if (kind === "generate") return "生图 / 上传中…";
  if (kind === "critique") return "评审中…";
  return "加载中…";
}

function mergeProposalDrafts(session: Session): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const iteration of session.iterations) {
    for (const proposal of iteration.critique?.proposals || []) {
      drafts[proposal.id] = proposal.prompt;
    }
  }
  return drafts;
}

function isFresher(candidate: Session, baseline: Session): boolean {
  if (candidate.iterations.length !== baseline.iterations.length) {
    return candidate.iterations.length > baseline.iterations.length;
  }
  return (
    new Date(candidate.updatedAt).getTime() >=
    new Date(baseline.updatedAt).getTime()
  );
}

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
  const [jobs, setJobs] = useState<Record<string, BusyKind>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>(
    {},
  );
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const pendingResultsRef = useRef<Record<string, PendingResult>>({});

  sessionIdRef.current = session?.id ?? null;

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
  const currentJob = session ? jobs[session.id] : undefined;
  const isCurrentBusy = Boolean(currentJob);
  const backgroundJobCount = Object.keys(jobs).filter(
    (id) => id !== session?.id,
  ).length;
  const visibleError =
    error || (session ? sessionErrors[session.id] : undefined) || null;

  const jobLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const [id, kind] of Object.entries(jobs)) {
      labels[id] = jobLabel(kind);
    }
    return labels;
  }, [jobs]);

  const setJob = useCallback((sessionId: string, kind: BusyKind | null) => {
    setJobs((prev) => {
      if (!kind) {
        if (!(sessionId in prev)) return prev;
        const next = { ...prev };
        delete next[sessionId];
        return next;
      }
      return { ...prev, [sessionId]: kind };
    });
  }, []);

  const clearSessionError = useCallback((sessionId: string) => {
    setSessionErrors((prev) => {
      if (!(sessionId in prev)) return prev;
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const reportSessionError = useCallback(
    (sessionId: string, message: string) => {
      setSessionErrors((prev) => ({ ...prev, [sessionId]: message }));
      if (sessionIdRef.current === sessionId) {
        setError(message);
      }
    },
    [],
  );

  const sessionErrorsRef = useRef(sessionErrors);
  sessionErrorsRef.current = sessionErrors;

  const showView = useCallback((next: Session, iterationId?: string | null) => {
    setSession(next);
    setTitleDraft(next.title);
    setProposalDrafts(mergeProposalDrafts(next));
    if (iterationId) {
      setActiveIterationId(iterationId);
    } else {
      const latest = next.iterations[next.iterations.length - 1];
      setActiveIterationId(latest?.id ?? null);
    }
    setError(sessionErrorsRef.current[next.id] ?? null);
  }, []);

  const applySessionIfActive = useCallback(
    (updated: Session, iterationId?: string | null) => {
      if (sessionIdRef.current !== updated.id) {
        // Job finished while user is elsewhere — keep result for when they return.
        pendingResultsRef.current[updated.id] = {
          session: updated,
          iterationId,
        };
        return;
      }
      delete pendingResultsRef.current[updated.id];
      setSession(updated);
      setTitleDraft(updated.title);
      setProposalDrafts(mergeProposalDrafts(updated));
      if (iterationId) {
        setActiveIterationId(iterationId);
      }
    },
    [],
  );

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
      const seq = ++loadSeqRef.current;
      setSwitching(true);
      setError(null);
      setPromptDraft("");
      clearPendingImage();
      setInputMode("prompt");
      setTaskModalOpen(false);

      // Instantly show a background-job result if we already have one.
      const eager = pendingResultsRef.current[id];
      if (eager && seq === loadSeqRef.current) {
        showView(eager.session, eager.iterationId);
      }

      try {
        const data = await apiJson<{ session: Session }>(`/api/sessions/${id}`);
        if (seq !== loadSeqRef.current) {
          return;
        }

        const pending = pendingResultsRef.current[id];
        let next = data.session;
        let iterationId: string | null | undefined =
          next.iterations[next.iterations.length - 1]?.id ?? null;

        if (pending && isFresher(pending.session, data.session)) {
          next = pending.session;
          iterationId = pending.iterationId;
        }
        delete pendingResultsRef.current[id];
        showView(next, iterationId);
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        // Keep eager view if we already showed a pending result.
        if (!eager) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (seq === loadSeqRef.current) {
          setSwitching(false);
        }
      }
    },
    [clearPendingImage, showView],
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

  async function handleCreateSession(input: {
    title: string;
    ownerName: string;
    description: string;
  }) {
    setCreating(true);
    setError(null);
    try {
      const created = await apiJson<{ session: Session }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          ownerName: input.ownerName,
          description: input.description,
        }),
      });
      ++loadSeqRef.current; // invalidate in-flight loads
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
      setCreating(false);
    }
  }

  async function runCritique(
    sessionId: string,
    iterationId: string,
    sessionSnapshot?: Session,
  ): Promise<Session> {
    const data = await apiJson<{ session: Session }>(
      `/api/sessions/${sessionId}/critique`,
      {
        method: "POST",
        body: JSON.stringify({ iterationId, sessionSnapshot }),
      },
    );
    return data.session;
  }

  async function handleGenerate(prompt: string) {
    if (!session) {
      setError("请先通过「任务管理」新建或打开一个任务");
      setTaskModalOpen(true);
      return;
    }
    if (jobs[session.id]) {
      setError("当前任务正在处理中，可先切换到其他任务");
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("prompt 不能为空");
      return;
    }

    const sessionId = session.id;
    const endpoint =
      session.iterations.length === 0
        ? `/api/sessions/${sessionId}/generate`
        : `/api/sessions/${sessionId}/iterate`;

    setJob(sessionId, "generate");
    clearSessionError(sessionId);
    setError(null);
    setPromptDraft("");
    try {
      const data = await apiJson<{ session: Session; iteration: { id: string } }>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({ prompt: trimmed }),
        },
      );

      setJob(sessionId, "critique");
      try {
        const withCritique = await runCritique(
          data.session.id,
          data.iteration.id,
          data.session,
        );
        applySessionIfActive(withCritique, data.iteration.id);
        if (sessionIdRef.current === sessionId) {
          setInputMode("prompt");
        }
        await refreshList();
      } catch (critiqueErr) {
        applySessionIfActive(data.session, data.iteration.id);
        const message =
          critiqueErr instanceof Error
            ? `图片已生成，但评审失败：${critiqueErr.message}`
            : "图片已生成，但评审失败；可点「仅重新评审」重试";
        reportSessionError(sessionId, message);
        if (sessionIdRef.current === sessionId) {
          setInputMode("prompt");
        }
        await refreshList();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "生图失败";
      reportSessionError(sessionId, message);
      if (sessionIdRef.current === sessionId) {
        setPromptDraft(trimmed);
      }
    } finally {
      setJob(sessionId, null);
    }
  }

  async function handleUploadAndCritique() {
    if (!session) {
      setError("请先通过「任务管理」新建或打开一个任务");
      setTaskModalOpen(true);
      return;
    }
    if (jobs[session.id]) {
      setError("当前任务正在处理中，可先切换到其他任务");
      return;
    }
    if (!pendingImage) {
      setError("请先选择图片");
      return;
    }

    const sessionId = session.id;
    const file = pendingImage.file;
    setJob(sessionId, "generate");
    clearSessionError(sessionId);
    setError(null);
    clearPendingImage();

    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch(`/api/sessions/${sessionId}/upload`, {
        method: "POST",
        body: form,
      });
      const text = await response.text();
      let data: { session?: Session; iteration?: { id: string }; error?: string };
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        throw new Error(
          text.replace(/\s+/g, " ").trim().slice(0, 180) ||
            `上传失败 (${response.status})`,
        );
      }
      if (!response.ok || !data.session || !data.iteration) {
        throw new Error(data.error || `上传失败 (${response.status})`);
      }

      setJob(sessionId, "critique");
      try {
        const withCritique = await runCritique(
          data.session.id,
          data.iteration.id,
          data.session,
        );
        applySessionIfActive(withCritique, data.iteration.id);
        if (sessionIdRef.current === sessionId) {
          setInputMode("prompt");
        }
        await refreshList();
      } catch (critiqueErr) {
        applySessionIfActive(data.session, data.iteration.id);
        const message =
          critiqueErr instanceof Error
            ? `图片已上传，但评审失败：${critiqueErr.message}`
            : "图片已上传，但评审失败；可点「仅重新评审」重试";
        reportSessionError(sessionId, message);
        if (sessionIdRef.current === sessionId) {
          setInputMode("prompt");
        }
        await refreshList();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "上传失败";
      reportSessionError(sessionId, message);
      if (sessionIdRef.current === sessionId) {
        setInputMode("upload");
        setImageFromFile(file);
      }
    } finally {
      setJob(sessionId, null);
    }
  }

  async function handleCritiqueOnly() {
    if (!session || !activeIteration) return;
    if (jobs[session.id]) {
      setError("当前任务正在处理中");
      return;
    }
    const sessionId = session.id;
    const iterationId = activeIteration.id;
    setJob(sessionId, "critique");
    clearSessionError(sessionId);
    setError(null);
    try {
      const withCritique = await runCritique(sessionId, iterationId, session);
      applySessionIfActive(withCritique, iterationId);
    } catch (err) {
      reportSessionError(
        sessionId,
        err instanceof Error ? err.message : "评审失败",
      );
    } finally {
      setJob(sessionId, null);
    }
  }

  async function handleDelete(id: string) {
    if (jobs[id]) {
      setError("该任务正在处理中，暂不能删除");
      return;
    }
    if (!confirm("确认删除该任务及其全部图片？")) return;
    try {
      await apiJson(`/api/sessions/${id}`, { method: "DELETE" });
      delete pendingResultsRef.current[id];
      clearSessionError(id);
      if (session?.id === id) {
        ++loadSeqRef.current;
        setSession(null);
        setActiveIterationId(null);
        setTitleDraft("");
        setPromptDraft("");
        clearPendingImage();
        setError(null);
      }
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    if (!session || isCurrentBusy || inputMode !== "upload") return;
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

  // Accept image paste globally so focus need not be on the upload dropzone.
  useEffect(() => {
    if (!session || isCurrentBusy) return;

    function onWindowPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        setInputMode("upload");
        setImageFromFile(file);
        break;
      }
    }

    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [session, isCurrentBusy, setImageFromFile]);

  function dismissError() {
    setError(null);
    if (session) clearSessionError(session.id);
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
                ? `${titleDraft}${session.ownerName ? ` · ${session.ownerName}` : ""} · ${session.iterations.length} 轮`
                : "Prompt → 生图 / 传图 → VLM 评审 → 再迭代"}
            </p>
            {session?.description ? (
              <p
                className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted)]"
                title={session.description}
              >
                {session.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setTaskModalOpen(true)}
            disabled={switching}
            className="shrink-0 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            任务管理
            {Object.keys(jobs).length > 0
              ? ` · ${Object.keys(jobs).length} 处理中`
              : ""}
          </button>
        </div>
      </header>

      {visibleError && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-1.5 text-sm text-red-700">
          {visibleError}
          <button
            type="button"
            className="ml-3 underline"
            onClick={dismissError}
          >
            关闭
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_380px] overflow-hidden">
        <aside className="min-h-0 overflow-hidden border-r border-[var(--line)]">
          <IterationTimeline
            iterations={session?.iterations ?? []}
            activeId={activeIteration?.id ?? null}
            onSelect={setActiveIterationId}
            loading={currentJob === "generate" || currentJob === "critique"}
            taskTitle={session ? titleDraft : undefined}
          />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface)]">
          <div className="min-h-0 flex-1 overflow-hidden">
            <ImageStage
              iteration={activeIteration}
              index={Math.max(activeIndex, 0)}
              loading={currentJob === "generate" || currentJob === "critique"}
              hasSession={Boolean(session)}
            />
          </div>

          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] p-3">
            {backgroundJobCount > 0 && (
              <p className="mb-2 text-[11px] text-[var(--muted)]">
                另有 {backgroundJobCount} 个任务在后台处理，可继续操作当前任务
              </p>
            )}
            <div className="mb-2 flex gap-1 rounded-lg bg-[var(--surface-strong)] p-1">
              <button
                type="button"
                disabled={!session || isCurrentBusy}
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
                disabled={!session || isCurrentBusy}
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
                  rows={5}
                  disabled={isCurrentBusy || !session}
                  placeholder={
                    !session
                      ? "请先打开「任务管理」新建或切换任务"
                      : isFirstRound
                        ? "描述画面、风格、构图、文字元素…"
                        : "完整方案或修改建议…"
                  }
                  className="min-h-[7.5rem] min-w-0 flex-1 resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={isCurrentBusy || !session}
                  onClick={() => void handleGenerate(promptDraft)}
                  className="shrink-0 self-stretch rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {currentJob === "generate"
                    ? "生图中…"
                    : currentJob === "critique"
                      ? "评审中…"
                      : "提交并评审"}
                </button>
              </div>
            ) : (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
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
                        disabled={isCurrentBusy}
                        className="text-xs text-[var(--accent)] underline disabled:opacity-50"
                      >
                        移除
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isCurrentBusy || !session}
                      onClick={() => void handleUploadAndCritique()}
                      className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      {currentJob === "generate"
                        ? "上传中…"
                        : currentJob === "critique"
                          ? "评审中…"
                          : "提交并评审"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!session || isCurrentBusy}
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
            disabled={isCurrentBusy}
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
        onCreate={(input) => void handleCreateSession(input)}
        onDelete={(id) => void handleDelete(id)}
        creating={creating}
        jobLabels={jobLabels}
      />
    </div>
  );
}
