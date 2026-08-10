import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_API_REQUESTS = 40;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || current.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_API_REQUESTS) {
    return false;
  }
  current.count += 1;
  return true;
}

function accessCookieOk(request: NextRequest): boolean {
  const required = process.env.ACCESS_CODE?.trim();
  if (!required) return true;
  const cookie = request.cookies.get("igw_access")?.value;
  return cookie === required;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never expose env / health internals beyond Next defaults.
  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/access") {
      return NextResponse.next();
    }

    if (!accessCookieOk(request)) {
      return NextResponse.json(
        { error: "需要访问码。请先在页面解锁。" },
        { status: 401 },
      );
    }

    const ip = clientIp(request);
    if (!allowRequest(ip)) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 },
      );
    }
  }

  if (
    !pathname.startsWith("/api/") &&
    pathname !== "/access" &&
    process.env.ACCESS_CODE?.trim() &&
    !accessCookieOk(request)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/access";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
