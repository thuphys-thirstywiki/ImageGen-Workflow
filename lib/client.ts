export function imageUrl(imagePath?: string): string | undefined {
  if (!imagePath) return undefined;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `/api/images/${imagePath.split("/").map(encodeURIComponent).join("/")}`;
}

function friendlyNonJsonError(status: number, text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (
    status === 504 ||
    /timed out|timeout|Task timed out/i.test(compact)
  ) {
    return "请求超时。生图与评审已分开执行，可先查看图片，再点「仅重新评审」。";
  }
  if (/An error occurred/i.test(compact)) {
    return `服务暂时失败（${status}）。若图片已生成，可点「仅重新评审」重试。`;
  }
  if (compact.length > 180) {
    return `${compact.slice(0, 180)}…`;
  }
  return compact || `请求失败 (${status})`;
}

export async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let data: (T & { error?: string }) | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(friendlyNonJsonError(response.status, text));
    }
  }
  if (!response.ok) {
    throw new Error(
      data?.error || friendlyNonJsonError(response.status, text || ""),
    );
  }
  if (!data) {
    throw new Error(`请求失败 (${response.status})：空响应`);
  }
  return data;
}
