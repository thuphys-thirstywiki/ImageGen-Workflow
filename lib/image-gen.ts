import { randomUUID } from "crypto";
import type { ImagesResponse } from "openai/resources/images";
import { createOpenAIClient, getImageModel } from "./openai";
import { appendIteration, getSession, saveImageBuffer } from "./sessions";
import { formatSessionContext } from "./task-context";
import type { Iteration, Session } from "./types";

function extFromMime(mime: string | undefined): string {
  if (!mime) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; ext: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载生成图片失败: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    ext: extFromMime(contentType),
  };
}

/** Combine prior round prompts with the latest user input for the image model. */
export function buildImagePrompt(
  session: Session,
  userInput: string,
): string {
  const trimmed = userInput.trim();
  const brief = formatSessionContext(session);
  const history = session.iterations
    .map((item, index) => `第${index + 1}轮：${item.prompt}`)
    .join("\n");

  if (!history) {
    return `${brief}\n\n本轮输入：\n${trimmed}`;
  }

  return `${brief}

以下是此前各轮的设计描述，请作为背景理解当前画面方向：
${history}

请根据「本轮输入」生成图片。本轮输入可以是完整方案，也可以是相对上一轮的修改意见；若是修改意见，请在历史方案基础上落实这些修改，并保持整体设计连贯，且始终对齐上述任务基本描述。

本轮输入：
${trimmed}`;
}

export async function generateImageForSession(
  sessionId: string,
  prompt: string,
): Promise<{ session: Session; iteration: Iteration }> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("prompt 不能为空");
  }

  const existing = await getSession(sessionId);
  if (!existing) {
    throw new Error("任务不存在");
  }

  const composedPrompt = buildImagePrompt(existing, trimmed);
  const client = createOpenAIClient();
  const model = getImageModel();

  const baseParams = {
    model,
    prompt: composedPrompt,
    n: 1,
    size: "1024x1024" as const,
  };

  let result: ImagesResponse;
  try {
    result = (await client.images.generate({
      ...baseParams,
      response_format: "b64_json",
    } as Parameters<typeof client.images.generate>[0])) as ImagesResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Only retry without response_format when the provider rejects that field.
    if (/response_format|unknown_parameter|unsupported/i.test(message)) {
      result = (await client.images.generate(
        baseParams as Parameters<typeof client.images.generate>[0],
      )) as ImagesResponse;
    } else {
      throw error;
    }
  }

  const first = result.data?.[0];
  if (!first) {
    throw new Error("生图接口未返回图片");
  }

  let buffer: Buffer;
  let ext = "png";

  if ("b64_json" in first && first.b64_json) {
    buffer = Buffer.from(first.b64_json, "base64");
  } else if ("url" in first && first.url) {
    const downloaded = await downloadImage(first.url);
    buffer = downloaded.buffer;
    ext = downloaded.ext;
  } else {
    throw new Error("生图接口既无 b64_json 也无 url");
  }

  const iterationId = randomUUID().replace(/-/g, "").slice(0, 12);
  const imagePath = await saveImageBuffer(sessionId, iterationId, buffer, ext);

  const iteration: Iteration = {
    id: iterationId,
    // Persist the user's round input (may be a delta); composed text is only for the API.
    prompt: trimmed,
    imagePath,
    source: "generate",
    createdAt: new Date().toISOString(),
  };

  const session = await appendIteration(sessionId, iteration);
  return { session, iteration };
}
