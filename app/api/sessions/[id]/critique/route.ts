import { NextResponse } from "next/server";
import { critiqueIteration } from "@/lib/critique";
import { publicErrorMessage } from "@/lib/errors";
import {
  getSessionWithIteration,
  sessionHasIteration,
} from "@/lib/sessions";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

function asSnapshot(
  raw: unknown,
  sessionId: string,
  iterationId: string,
): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Session;
  if (candidate.id !== sessionId) return null;
  if (!Array.isArray(candidate.iterations)) return null;
  if (!sessionHasIteration(candidate, iterationId)) return null;
  return {
    ...candidate,
    title: (candidate.title || "").trim() || "未命名设计任务",
    description: (candidate.description || "").trim(),
    ownerName: (candidate.ownerName || "").trim(),
    iterations: candidate.iterations,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      iterationId?: string;
      sessionSnapshot?: unknown;
    };

    if (!body.iterationId?.trim()) {
      return NextResponse.json(
        { error: "缺少 iterationId，请指定要评审的图片轮次" },
        { status: 400 },
      );
    }

    const iterationId = body.iterationId.trim();
    const snapshot = asSnapshot(body.sessionSnapshot, id, iterationId);

    let session: Session;
    try {
      session = await getSessionWithIteration(id, iterationId);
    } catch (error) {
      if (snapshot) {
        session = snapshot;
      } else {
        throw error;
      }
    }

    const { session: updated, critique } = await critiqueIteration(
      session,
      iterationId,
    );

    return NextResponse.json({ session: updated, critique, iterationId });
  } catch (error) {
    const message = publicErrorMessage(error, "评审失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
