import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const required = process.env.ACCESS_CODE?.trim();
  if (!required) {
    return NextResponse.json({ ok: true, required: false });
  }

  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = body.code?.trim() || "";
  if (code !== required) {
    return NextResponse.json({ error: "访问码错误" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, required: true });
  response.cookies.set("igw_access", required, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function GET() {
  return NextResponse.json({
    required: Boolean(process.env.ACCESS_CODE?.trim()),
  });
}
