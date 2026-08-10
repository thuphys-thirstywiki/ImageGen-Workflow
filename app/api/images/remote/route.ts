import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isAllowedRemote(url: URL): boolean {
  // Public Vercel Blob hosts and common CDN patterns used by this app.
  return (
    url.protocol === "https:" &&
    (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
      url.hostname.endsWith(".blob.vercel-storage.com"))
  );
}

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("u")?.trim();
    if (!raw) {
      return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return NextResponse.json({ error: "非法图片地址" }, { status: 400 });
    }

    if (!isAllowedRemote(target)) {
      return NextResponse.json({ error: "不允许的图片来源" }, { status: 400 });
    }

    const upstream = await fetch(target.toString());
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `拉取图片失败 (${upstream.status})` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "代理图片失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
