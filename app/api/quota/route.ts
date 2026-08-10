import { NextResponse } from "next/server";
import { getQuota } from "@/lib/quota";
import { publicErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const quota = await getQuota();
    return NextResponse.json({ quota });
  } catch (error) {
    const message = publicErrorMessage(error, "读取余额失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
