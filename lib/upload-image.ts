import { randomUUID } from "crypto";
import { appendIteration, saveImageBuffer } from "./sessions";
import type { Iteration, Session } from "./types";

function extFromMime(mime: string | undefined): string {
  if (!mime) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

/** Store an uploaded image as a new iteration (critique is a separate step). */
export async function uploadImageForSession(
  sessionId: string,
  buffer: Buffer,
  mimeType: string | undefined,
): Promise<{ session: Session; iteration: Iteration }> {
  const iterationId = randomUUID().replace(/-/g, "").slice(0, 12);
  const ext = extFromMime(mimeType);
  const imagePath = await saveImageBuffer(sessionId, iterationId, buffer, ext);

  const iteration: Iteration = {
    id: iterationId,
    prompt: "用户上传",
    imagePath,
    source: "upload",
    createdAt: new Date().toISOString(),
  };

  const session = await appendIteration(sessionId, iteration);
  return { session, iteration };
}
