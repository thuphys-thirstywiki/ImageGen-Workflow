import { NextResponse } from "next/server";
import { critiqueIteration } from "@/lib/critique";
import { publicErrorMessage } from "@/lib/errors";
import { generateImageForSession } from "@/lib/image-gen";
import { getSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

    const { session: withImage, iteration } = await generateImageForSession(
      id,
      prompt,
    );
    const { session: withCritique } = await critiqueIteration(
      withImage,
      iteration.id,
    );
    const updatedIteration =
      withCritique.iterations.find((item) => item.id === iteration.id) ||
      iteration;

    return NextResponse.json({
      session: withCritique,
      iteration: updatedIteration,
    });
  } catch (error) {
    const message = publicErrorMessage(error, "生图失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
