import { randomUUID } from "crypto";
import { del, get, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { Iteration, Session, SessionSummary } from "./types";

function getBlobToken(): string {
  // Prefer bracket access so Next doesn't hard-inline an empty build-time value.
  return (process.env["BLOB_READ_WRITE_TOKEN"] || "").trim();
}

function useBlobStorage(): boolean {
  if (getBlobToken()) return true;
  // On Vercel the filesystem is read-only; never fall back to local disk.
  if (process.env["VERCEL"]) {
    throw new Error(
      "云端未配置 BLOB_READ_WRITE_TOKEN。请在 Vercel 项目中创建并关联 Blob Store。",
    );
  }
  return false;
}

function dataRoot(): string {
  if (process.env["VERCEL"]) {
    throw new Error("Vercel 环境禁止使用本地磁盘存储");
  }
  const configured = process.env["DATA_DIR"]?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "data", "sessions");
}

function assertSafeSessionId(sessionId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error("非法的 session id");
  }
}

function sessionBlobKey(sessionId: string): string {
  return `sessions/${sessionId}/session.json`;
}

function imageBlobKey(sessionId: string, iterationId: string, ext: string): string {
  return `sessions/${sessionId}/images/${iterationId}.${ext}`;
}

function mimeFromExt(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "image/png";
}

export function isRemoteImagePath(imagePath: string): boolean {
  return /^https?:\/\//i.test(imagePath);
}

async function ensureLocalRoot(): Promise<string> {
  const root = dataRoot();
  await fs.mkdir(/*turbopackIgnore: true*/ root, { recursive: true });
  return root;
}

function localSessionDir(root: string, sessionId: string): string {
  return path.join(/*turbopackIgnore: true*/ root, sessionId);
}

async function readLocalSession(sessionId: string): Promise<Session | null> {
  const root = await ensureLocalRoot();
  try {
    const raw = await fs.readFile(
      path.join(/*turbopackIgnore: true*/ localSessionDir(root, sessionId), "session.json"),
      "utf8",
    );
    return JSON.parse(raw) as Session;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw error;
  }
}

async function writeLocalSession(session: Session): Promise<void> {
  const root = await ensureLocalRoot();
  const dir = localSessionDir(root, session.id);
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await fs.writeFile(
    path.join(/*turbopackIgnore: true*/ dir, "session.json"),
    JSON.stringify(session, null, 2),
    "utf8",
  );
}

async function readBlobSession(sessionId: string): Promise<Session | null> {
  const key = sessionBlobKey(sessionId);
  // Bypass CDN so a just-written session.json is visible to the next request
  // (generate → critique). Cached public URLs often lag and look like “迭代不存在”.
  const result = await get(key, { access: "public", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  const text = await new Response(result.stream).text();
  if (!text.trim()) return null;
  return JSON.parse(text) as Session;
}

async function writeBlobSession(session: Session): Promise<void> {
  await put(sessionBlobKey(session.id), JSON.stringify(session), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // Shortest allowed cache; reads still use useCache:false for correctness.
    cacheControlMaxAge: 60,
  });
}

export async function listSessions(): Promise<SessionSummary[]> {
  const summaries: SessionSummary[] = [];

  if (useBlobStorage()) {
    const listed = await list({ prefix: "sessions/", limit: 1000 });
    const ids = new Set<string>();
    for (const blob of listed.blobs) {
      const match = blob.pathname.match(/^sessions\/([^/]+)\/session\.json$/);
      if (match) ids.add(match[1]);
    }
    for (const id of ids) {
      const session = await getSession(id);
      if (!session) continue;
      summaries.push(toSummary(session));
    }
  } else {
    const root = await ensureLocalRoot();
    const entries = await fs.readdir(/*turbopackIgnore: true*/ root, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const session = await getSession(entry.name);
      if (!session) continue;
      summaries.push(toSummary(session));
    }
  }

  return summaries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function normalizeSession(raw: Session): Session {
  return {
    ...raw,
    title: (raw.title || "").trim() || "未命名设计任务",
    ownerName: (raw.ownerName || "").trim(),
    iterations: Array.isArray(raw.iterations) ? raw.iterations : [],
  };
}

function toSummary(session: Session): SessionSummary {
  const latest = session.iterations[session.iterations.length - 1];
  return {
    id: session.id,
    title: session.title,
    ownerName: session.ownerName,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    iterationCount: session.iterations.length,
    latestImagePath: latest?.imagePath,
  };
}

export async function getSession(sessionId: string): Promise<Session | null> {
  assertSafeSessionId(sessionId);
  const raw = useBlobStorage()
    ? await readBlobSession(sessionId)
    : await readLocalSession(sessionId);
  return raw ? normalizeSession(raw) : null;
}

export async function createSession(
  title: string,
  ownerName: string,
): Promise<Session> {
  const trimmedTitle = title.trim();
  const trimmedOwner = ownerName.trim();
  if (!trimmedTitle) {
    throw new Error("请填写任务名称");
  }
  if (!trimmedOwner) {
    throw new Error("请填写使用者姓名");
  }
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const now = new Date().toISOString();
  const session: Session = {
    id,
    title: trimmedTitle,
    ownerName: trimmedOwner,
    createdAt: now,
    updatedAt: now,
    iterations: [],
  };
  await saveSession(session);
  return session;
}

export async function saveSession(session: Session): Promise<void> {
  assertSafeSessionId(session.id);
  session.updatedAt = new Date().toISOString();
  if (useBlobStorage()) {
    await writeBlobSession(session);
    return;
  }
  await writeLocalSession(session);
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  assertSafeSessionId(sessionId);
  if (useBlobStorage()) {
    const listed = await list({
      prefix: `sessions/${sessionId}/`,
      limit: 1000,
    });
    if (listed.blobs.length === 0) return false;
    await del(listed.blobs.map((blob) => blob.url));
    return true;
  }

  const root = await ensureLocalRoot();
  try {
    await fs.rm(/*turbopackIgnore: true*/ localSessionDir(root, sessionId), {
      recursive: true,
      force: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function saveImageBuffer(
  sessionId: string,
  iterationId: string,
  buffer: Buffer,
  ext: string = "png",
): Promise<string> {
  assertSafeSessionId(sessionId);
  const safeExt = ext.replace(/^\./, "") || "png";

  if (useBlobStorage()) {
    const blob = await put(
      imageBlobKey(sessionId, iterationId, safeExt),
      buffer,
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeFromExt(safeExt),
      },
    );
    return blob.url;
  }

  const root = await ensureLocalRoot();
  const imagesDir = path.join(
    /*turbopackIgnore: true*/ localSessionDir(root, sessionId),
    "images",
  );
  await fs.mkdir(/*turbopackIgnore: true*/ imagesDir, { recursive: true });
  const filename = `${iterationId}.${safeExt}`;
  await fs.writeFile(
    path.join(/*turbopackIgnore: true*/ imagesDir, filename),
    buffer,
  );
  return path.join(sessionId, "images", filename);
}

export async function readImageBuffer(
  imagePath: string,
): Promise<{ buffer: Buffer; mime: string }> {
  if (isRemoteImagePath(imagePath)) {
    const response = await fetch(imagePath);
    if (!response.ok) {
      throw new Error(`读取云端图片失败: ${response.status}`);
    }
    const mime =
      response.headers.get("content-type") || mimeFromExt(path.extname(imagePath));
    return { buffer: Buffer.from(await response.arrayBuffer()), mime };
  }

  const root = await ensureLocalRoot();
  const normalized = path
    .normalize(imagePath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.join(/*turbopackIgnore: true*/ root, normalized);
  const rootResolved = path.resolve(/*turbopackIgnore: true*/ root);
  const absResolved = path.resolve(/*turbopackIgnore: true*/ absolute);
  if (
    !absResolved.startsWith(rootResolved + path.sep) &&
    absResolved !== rootResolved
  ) {
    throw new Error("非法的图片路径");
  }
  const buffer = await fs.readFile(/*turbopackIgnore: true*/ absolute);
  return { buffer, mime: mimeFromExt(path.extname(absolute)) };
}

/** @deprecated use readImageBuffer; kept for local image route */
export function resolveImagePath(relativePath: string): string {
  if (isRemoteImagePath(relativePath)) {
    throw new Error("远程图片请直接使用 URL");
  }
  const root = dataRoot();
  const normalized = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.join(/*turbopackIgnore: true*/ root, normalized);
  const rootResolved = path.resolve(/*turbopackIgnore: true*/ root);
  const absResolved = path.resolve(/*turbopackIgnore: true*/ absolute);
  if (
    !absResolved.startsWith(rootResolved + path.sep) &&
    absResolved !== rootResolved
  ) {
    throw new Error("非法的图片路径");
  }
  return absResolved;
}

export async function appendIteration(
  sessionId: string,
  iteration: Iteration,
): Promise<Session> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("任务不存在");
  }
  session.iterations.push(iteration);
  await saveSession(session);
  return session;
}

export async function updateIterationCritique(
  sessionId: string,
  iterationId: string,
  critique: Iteration["critique"],
): Promise<Session> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("任务不存在");
  }
  const iteration = session.iterations.find((item) => item.id === iterationId);
  if (!iteration) {
    throw new Error("迭代不存在");
  }
  iteration.critique = critique;
  await saveSession(session);
  return session;
}

/** Wait briefly for a newly written iteration to become readable from Blob. */
export async function getSessionWithIteration(
  sessionId: string,
  iterationId: string,
  attempts = 5,
): Promise<Session> {
  let last: Session | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await getSession(sessionId);
    if (last?.iterations.some((item) => item.id === iterationId)) {
      return last;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
    }
  }
  if (!last) {
    throw new Error("任务不存在");
  }
  throw new Error("迭代不存在");
}
