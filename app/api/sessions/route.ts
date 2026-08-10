import { NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "列出任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string };
    const session = await createSession(body.title || "未命名设计任务");
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
