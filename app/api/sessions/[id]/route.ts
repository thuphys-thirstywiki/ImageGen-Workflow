import { NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/sessions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ok = await deleteSession(id);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
