import { NextResponse } from "next/server";
import { publicErrorMessage } from "@/lib/errors";
import { generateImageForSession } from "@/lib/image-gen";
import { consumeQuota, refundQuota } from "@/lib/quota";
import { getSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  let charged = false;
  try {
    const { id } = await context.params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
    }

    await consumeQuota("image");
    charged = true;

    const { session: withImage, iteration } = await generateImageForSession(
      id,
      prompt,
    );

    return NextResponse.json({
      session: withImage,
      iteration,
    });
  } catch (error) {
    if (charged) {
      try {
        await refundQuota("image");
      } catch {
        // ignore refund failures
      }
    }
    const message = publicErrorMessage(error, "生图失败");
    const status = message.includes("余额不足") ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
