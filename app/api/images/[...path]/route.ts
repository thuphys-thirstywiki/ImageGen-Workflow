import { NextResponse } from "next/server";
import { isRemoteImagePath, readImageBuffer } from "@/lib/sessions";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { path: parts } = await context.params;
    if (!parts?.length) {
      return NextResponse.json({ error: "缺少路径" }, { status: 400 });
    }

    const relative = parts.join("/");
    if (isRemoteImagePath(relative)) {
      return NextResponse.redirect(relative);
    }

    const { buffer, mime } = await readImageBuffer(relative);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取图片失败";
    const status = message.includes("非法") ? 400 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
