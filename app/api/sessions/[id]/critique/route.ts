import { NextResponse } from "next/server";
import { critiqueIteration } from "@/lib/critique";
import { publicErrorMessage } from "@/lib/errors";
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

    const body = (await request.json().catch(() => ({}))) as {
      iterationId?: string;
    };

    const iterationId =
      body.iterationId ||
      session.iterations[session.iterations.length - 1]?.id;

    if (!iterationId) {
      return NextResponse.json({ error: "没有可评审的图片" }, { status: 400 });
    }

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
