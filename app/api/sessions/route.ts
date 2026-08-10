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
    const body = (await request.json()) as {
      title?: string;
      ownerName?: string;
    };
    const title = typeof body.title === "string" ? body.title : "";
    const ownerName = typeof body.ownerName === "string" ? body.ownerName : "";
    if (!title.trim() || !ownerName.trim()) {
      return NextResponse.json(
        { error: "请填写任务名称和使用者姓名" },
        { status: 400 },
      );
    }
    const session = await createSession(title, ownerName);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
