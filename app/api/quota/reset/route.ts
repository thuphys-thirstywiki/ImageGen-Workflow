import { NextResponse } from "next/server";
import { assertAdminPassword } from "@/lib/admin";
import { publicErrorMessage } from "@/lib/errors";
import { resetQuota } from "@/lib/quota";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      adminPassword?: string;
    };
    assertAdminPassword(body.adminPassword);
    const quota = await resetQuota();
    return NextResponse.json({ quota });
  } catch (error) {
    const message = publicErrorMessage(error, "重置余额失败");
    const status = message.includes("密码") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
