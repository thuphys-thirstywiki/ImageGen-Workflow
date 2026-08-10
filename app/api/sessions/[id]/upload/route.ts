import { NextResponse } from "next/server";
import { getSession } from "@/lib/sessions";
import { publicErrorMessage } from "@/lib/errors";
import { uploadImageForCritique } from "@/lib/upload-image";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "仅支持图片文件" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "图片过大（上限 12MB）" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { session: updated, iteration } = await uploadImageForCritique(
      id,
      buffer,
      file.type,
    );

    return NextResponse.json({ session: updated, iteration });
  } catch (error) {
    const message = publicErrorMessage(error, "上传评审失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
