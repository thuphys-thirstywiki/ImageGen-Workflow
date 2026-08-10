"use client";

import { useState, type FormEvent } from "react";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "解锁失败");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "解锁失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--bg)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-lg"
      >
        <h1 className="font-display text-xl text-[var(--ink)]">访问解锁</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          输入共享访问码后即可使用。API Key 仅保存在服务器，不会下发到浏览器。
        </p>
        <input
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="访问码"
          className="mt-4 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="mt-4 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "验证中…" : "进入"}
        </button>
      </form>
    </div>
  );
}
