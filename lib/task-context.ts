import type { Session } from "./types";

/** Shared task brief injected into image-gen and VLM critique prompts. */
export function formatSessionContext(session: Session): string {
  const title = (session.title || "").trim() || "未命名设计任务";
  const description = (session.description || "").trim();

  const lines = [`设计任务：${title}`];
  if (description) {
    lines.push(`任务基本描述：\n${description}`);
  }
  return lines.join("\n");
}
