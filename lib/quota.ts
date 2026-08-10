import { get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

export type QuotaKind = "image" | "critique";

export type QuotaState = {
  imageRemaining: number;
  critiqueRemaining: number;
  imageLimit: number;
  critiqueLimit: number;
  updatedAt: string;
};

const QUOTA_BLOB_KEY = "meta/quota.json";

function imageLimit(): number {
  const raw = Number(process.env["IMAGE_QUOTA_LIMIT"] || "30");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}

function critiqueLimit(): number {
  const raw = Number(process.env["CRITIQUE_QUOTA_LIMIT"] || "100");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
}

function useBlob(): boolean {
  return Boolean((process.env["BLOB_READ_WRITE_TOKEN"] || "").trim());
}

function localQuotaPath(): string {
  const configured = process.env["DATA_DIR"]?.trim();
  const root = configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "data", "sessions");
  return path.join(/*turbopackIgnore: true*/ root, "..", "quota.json");
}

function defaultQuota(): QuotaState {
  const image = imageLimit();
  const critique = critiqueLimit();
  return {
    imageRemaining: image,
    critiqueRemaining: critique,
    imageLimit: image,
    critiqueLimit: critique,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeQuota(raw: Partial<QuotaState> | null | undefined): QuotaState {
  const defaults = defaultQuota();
  const imageLimitValue =
    typeof raw?.imageLimit === "number" && raw.imageLimit > 0
      ? Math.floor(raw.imageLimit)
      : defaults.imageLimit;
  const critiqueLimitValue =
    typeof raw?.critiqueLimit === "number" && raw.critiqueLimit > 0
      ? Math.floor(raw.critiqueLimit)
      : defaults.critiqueLimit;
  const imageRemaining =
    typeof raw?.imageRemaining === "number"
      ? Math.max(0, Math.floor(raw.imageRemaining))
      : imageLimitValue;
  const critiqueRemaining =
    typeof raw?.critiqueRemaining === "number"
      ? Math.max(0, Math.floor(raw.critiqueRemaining))
      : critiqueLimitValue;
  return {
    imageRemaining,
    critiqueRemaining,
    imageLimit: imageLimitValue,
    critiqueLimit: critiqueLimitValue,
    updatedAt:
      typeof raw?.updatedAt === "string" ? raw.updatedAt : defaults.updatedAt,
  };
}

async function readQuota(): Promise<QuotaState> {
  if (useBlob()) {
    const result = await get(QUOTA_BLOB_KEY, {
      access: "public",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return defaultQuota();
    }
    const text = await new Response(result.stream).text();
    if (!text.trim()) return defaultQuota();
    try {
      return normalizeQuota(JSON.parse(text) as Partial<QuotaState>);
    } catch {
      return defaultQuota();
    }
  }

  try {
    const raw = await fs.readFile(
      /*turbopackIgnore: true*/ localQuotaPath(),
      "utf8",
    );
    return normalizeQuota(JSON.parse(raw) as Partial<QuotaState>);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return defaultQuota();
    throw error;
  }
}

async function writeQuota(state: QuotaState): Promise<void> {
  const payload = JSON.stringify(state, null, 2);
  if (useBlob()) {
    await put(QUOTA_BLOB_KEY, payload, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }

  const filePath = localQuotaPath();
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(filePath), {
    recursive: true,
  });
  await fs.writeFile(/*turbopackIgnore: true*/ filePath, payload, "utf8");
}

export async function getQuota(): Promise<QuotaState> {
  const state = await readQuota();
  // Keep limits in sync with current env defaults when displaying.
  return {
    ...state,
    imageLimit: imageLimit(),
    critiqueLimit: critiqueLimit(),
  };
}

export async function resetQuota(): Promise<QuotaState> {
  const state = defaultQuota();
  await writeQuota(state);
  return state;
}

export async function consumeQuota(kind: QuotaKind): Promise<QuotaState> {
  const state = await getQuota();
  if (kind === "image") {
    if (state.imageRemaining <= 0) {
      throw new Error("生图余额不足，请联系管理员重置");
    }
    state.imageRemaining -= 1;
  } else {
    if (state.critiqueRemaining <= 0) {
      throw new Error("评审余额不足，请联系管理员重置");
    }
    state.critiqueRemaining -= 1;
  }
  state.updatedAt = new Date().toISOString();
  await writeQuota(state);
  return state;
}

export async function refundQuota(kind: QuotaKind): Promise<QuotaState> {
  const state = await getQuota();
  if (kind === "image") {
    state.imageRemaining = Math.min(
      state.imageLimit,
      state.imageRemaining + 1,
    );
  } else {
    state.critiqueRemaining = Math.min(
      state.critiqueLimit,
      state.critiqueRemaining + 1,
    );
  }
  state.updatedAt = new Date().toISOString();
  await writeQuota(state);
  return state;
}
