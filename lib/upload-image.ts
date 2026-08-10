import { randomUUID } from "crypto";
import { critiqueIteration } from "./critique";
import { appendIteration, saveImageBuffer } from "./sessions";
import type { Iteration, Session } from "./types";

function extFromMime(mime: string | undefined): string {
  if (!mime) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

/** Each round must have an image: either text-to-image, or a user-uploaded file. */
export async function uploadImageForCritique(
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

  const withImage = await appendIteration(sessionId, iteration);
  const { session } = await critiqueIteration(withImage, iteration.id);
  const updated =
    session.iterations.find((item) => item.id === iterationId) || iteration;

  return { session, iteration: updated };
}
