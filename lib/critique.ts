import { randomUUID } from "crypto";
import { createOpenAIClient, getVlmModel } from "./openai";
import {
  isRemoteImagePath,
  readImageBuffer,
  updateIterationCritique,
} from "./sessions";
import type { Critique, Proposal, Session } from "./types";

const CRITIQUE_SYSTEM = `你是一位资深视觉设计师与创意总监。你会审阅一张根据用户任务生成的设计图，并给出专业、可执行的改进建议，以及若干可直接用于下一轮文生图的新方案。

请严格输出一个 JSON 对象（不要 Markdown 代码块），字段如下：
{
  "summary": "2-4 句总体评价，指出优点与主要问题",
  "improvements": ["具体改进点1", "具体改进点2", ...],
  "proposals": [
    {
      "title": "方案短标题",
      "prompt": "完整的下一轮生图 prompt（中文为主，可含风格、构图、色彩、文字元素等细节）"
    }
  ]
}

要求：
- improvements 给出 3-6 条可操作建议
- proposals 给出 3 个差异明显的设计方向，prompt 要完整、可直接用于生图
- 结合任务目标与历史迭代上下文，避免空泛评价
- 全部内容使用简体中文`;

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
  const proposals: Proposal[] = proposalsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const p = item as Record<string, unknown>;
      const title = typeof p.title === "string" ? p.title : "未命名方案";
      const prompt = typeof p.prompt === "string" ? p.prompt : "";
      if (!prompt.trim()) return null;
      return {
        id: randomUUID().replace(/-/g, "").slice(0, 10),
        title,
        prompt,
      };
    })
    .filter((item): item is Proposal => item !== null);

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

  const userText = `设计任务：${session.title}

迭代历史：
${history}

请审阅当前这张图，给出改进建议与 3 个新的设计方案 prompt。`;

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
  const updated = await updateIterationCritique(session.id, iterationId, critique);
  return { session: updated, critique };
}
