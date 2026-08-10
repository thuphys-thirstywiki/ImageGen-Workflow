import { randomUUID } from "crypto";
import { createOpenAIClient, getVlmModel } from "./openai";
import {
  isRemoteImagePath,
  readImageBuffer,
  updateIterationCritique,
} from "./sessions";
import { formatSessionContext } from "./task-context";
import type { Critique, Proposal, Session } from "./types";

const CRITIQUE_SYSTEM = `你是一位资深视觉设计师与创意总监。你的核心职责不是长篇点评现状，而是给出可落地的改进路径，并产出可直接用于下一轮文生图的方案。

请严格输出一个 JSON 对象（不要 Markdown 代码块），字段如下：
{
  "summary": "1-2 句极简点评：当前图离任务目标还差在哪里（不要展开优点清单）",
  "improvements": [
    "一条完整、可操作的改进建议（写清改什么、为什么、期望效果）",
    "..."
  ],
  "proposals": [
    {
      "kind": "refine 或 rework",
      "title": "方案短标题（体现方向）",
      "prompt": "完整的下一轮生图 prompt（中文为主，含构图、主体、风格、色彩、材质、文字/信息层级、氛围等，可直接粘贴生图）"
    }
  ]
}

优先级与要求：
1. improvements 是重点：给出 4-7 条完整、具体、可执行的建议，避免空泛形容词。可混合「在现有基础上微调」与「结构性大改」两类思路。
2. proposals 是重点：给出 3-4 个差异明显的下一轮方案。每个方案必须标注 kind：
   - refine：在当前画面基础上改进（保留主体/版式骨架，针对性修问题）
   - rework：大改一版（允许大幅换构图、风格或叙事，仍服务同一设计任务）
   两类都要有；具体各给几条由你根据当前图的问题严重程度自行决定。prompt 必须完整、可直接用于生图，不要只写「把对比加强」这类残缺指令。
3. summary 仅作辅线：1-2 句即可，不要占篇幅。
4. 结合任务目标与历史迭代，避免重复上一轮已试过且无效的方向。
5. 全部内容使用简体中文。`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("VLM 未返回可解析的 JSON");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeKind(value: unknown): "refine" | "rework" | undefined {
  if (typeof value !== "string") return undefined;
  const lower = value.trim().toLowerCase();
  if (lower === "refine" || lower.includes("渐进") || lower.includes("微调") || lower.includes("现有")) {
    return "refine";
  }
  if (lower === "rework" || lower.includes("大改") || lower.includes("重做") || lower.includes("重构")) {
    return "rework";
  }
  return undefined;
}

function normalizeCritique(raw: unknown): Critique {
  if (!raw || typeof raw !== "object") {
    throw new Error("VLM 返回格式无效");
  }
  const obj = raw as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  const improvements = Array.isArray(obj.improvements)
    ? obj.improvements.filter((item): item is string => typeof item === "string")
    : [];
  const proposalsRaw = Array.isArray(obj.proposals) ? obj.proposals : [];
  const proposals: Proposal[] = proposalsRaw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const p = item as Record<string, unknown>;
    const title = typeof p.title === "string" ? p.title : "未命名方案";
    const prompt = typeof p.prompt === "string" ? p.prompt : "";
    if (!prompt.trim()) return [];
    const proposal: Proposal = {
      id: randomUUID().replace(/-/g, "").slice(0, 10),
      title,
      prompt,
    };
    const kind = normalizeKind(p.kind);
    if (kind) proposal.kind = kind;
    return [proposal];
  });

  if (!summary && improvements.length === 0 && proposals.length === 0) {
    throw new Error("VLM 返回内容为空");
  }

  return { summary, improvements, proposals };
}

function mimeFromPath(imagePath: string): string {
  const lower = imagePath.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

async function imageUrlForVlm(imagePath: string): Promise<string> {
  if (isRemoteImagePath(imagePath)) {
    return imagePath;
  }
  const { buffer, mime } = await readImageBuffer(imagePath);
  return `data:${mime || mimeFromPath(imagePath)};base64,${buffer.toString("base64")}`;
}

export async function critiqueIteration(
  session: Session,
  iterationId: string,
): Promise<{ session: Session; critique: Critique }> {
  const iteration = session.iterations.find((item) => item.id === iterationId);
  if (!iteration) {
    throw new Error("迭代不存在");
  }

  const visionUrl = await imageUrlForVlm(iteration.imagePath);

  const history = session.iterations
    .map(
      (item, index) =>
        `第 ${index + 1} 轮 prompt：${item.prompt}${item.id === iterationId ? "（当前）" : ""}`,
    )
    .join("\n");

  const userText = `${formatSessionContext(session)}

迭代历史：
${history}

请审阅当前这张图是否契合上述任务基本描述与目标。把精力放在「改进建议」和「下一轮完整方案」上；总体评价只要一两句。方案需同时覆盖「在现有基础上改进」与「大改一版」，比例由你根据当前问题自行决定；所有方案都必须继续服务同一任务描述。`;

  const client = createOpenAIClient();
  const model = getVlmModel();

  const messages = [
    { role: "system" as const, content: CRITIQUE_SYSTEM },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: userText },
        { type: "image_url" as const, image_url: { url: visionUrl } },
      ],
    },
  ];

  let content: string | null | undefined;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages,
    });
    content = completion.choices[0]?.message?.content;
  } catch {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages,
    });
    content = completion.choices[0]?.message?.content;
  }

  if (!content) {
    throw new Error("VLM 未返回内容");
  }

  const critique = normalizeCritique(extractJson(content));
  const updated = await updateIterationCritique(
    session.id,
    iterationId,
    critique,
    session,
  );
  return { session: updated, critique };
}
