"use client";

import { useState } from "react";
import type { Iteration } from "@/lib/types";
import { imageUrl } from "@/lib/client";

type Props = {
  iteration: Iteration | null;
  index: number;
  loading?: boolean;
  hasSession?: boolean;
};

async function fetchImageBlob(src: string): Promise<Blob> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`读取图片失败 (${response.status})`);
  }
  return response.blob();
}

function extensionFromBlob(blob: Blob, fallbackPath?: string): string {
  const fromType = blob.type.split("/")[1]?.replace("jpeg", "jpg");
  if (fromType) return fromType;
  const match = fallbackPath?.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1] || "png";
}

export function ImageStage({
  iteration,
  index,
  loading,
  hasSession,
}: Props) {
  const src = imageUrl(iteration?.imagePath);
  const [busy, setBusy] = useState<"copy" | "save" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function handleSave() {
    if (!src || !iteration) return;
    setBusy("save");
    setNote(null);
    try {
      const blob = await fetchImageBlob(src);
      const ext = extensionFromBlob(blob, iteration.imagePath);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `imagegen-r${index + 1}-${iteration.id}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNote("已开始下载");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    if (!src) return;
    setBusy("copy");
    setNote(null);
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("当前浏览器不支持复制图片");
      }
      const blob = await fetchImageBlob(src);
      const pngBlob =
        blob.type === "image/png"
          ? blob
          : await (async () => {
              const bitmap = await createImageBitmap(blob);
              const canvas = document.createElement("canvas");
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("无法转换图片格式");
              ctx.drawImage(bitmap, 0, 0);
              bitmap.close();
              return new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (result) =>
                    result ? resolve(result) : reject(new Error("转换 PNG 失败")),
                  "image/png",
                );
              });
            })();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      setNote("已复制到剪贴板");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "复制失败");
    } finally {
      setBusy(null);
    }
  }

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
        <div className="flex shrink-0 items-center gap-2">
          {note && !loading && (
            <span className="max-w-[9rem] truncate text-[11px] text-[var(--muted)]">
              {note}
            </span>
          )}
          {loading ? (
            <span className="animate-pulse text-xs text-[var(--accent)]">
              处理中…
            </span>
          ) : src ? (
            <>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={busy !== null}
                className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {busy === "copy" ? "复制中…" : "复制"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy !== null}
                className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {busy === "save" ? "保存中…" : "保存"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative z-[1] flex min-h-0 flex-1 items-center justify-center p-3">
        {loading ? (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]"
              aria-hidden
            />
            <p className="text-sm text-[var(--muted)]">
              生图与评审进行中，完成后一并展示
            </p>
          </div>
        ) : src ? (
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
