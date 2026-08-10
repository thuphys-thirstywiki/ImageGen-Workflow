import { NextResponse } from "next/server";
import { critiqueIteration } from "@/lib/critique";
import { publicErrorMessage } from "@/lib/errors";
import { getSessionWithIteration } from "@/lib/sessions";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      iterationId?: string;
    };

    if (!body.iterationId?.trim()) {
      return NextResponse.json(
        { error: "缺少 iterationId，请指定要评审的图片轮次" },
        { status: 400 },
      );
    }

    const iterationId = body.iterationId.trim();
    const session = await getSessionWithIteration(id, iterationId);

    const { session: updated, critique } = await critiqueIteration(
      session,
      iterationId,
    );

    return NextResponse.json({ session: updated, critique, iterationId });
  } catch (error) {
    const message = publicErrorMessage(error, "评审失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
