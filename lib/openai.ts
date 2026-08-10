import OpenAI from "openai";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 .env.local 中配置`);
  }
  return value;
}

/** Ensure OpenAI SDK hits /v1/* even if VAPI_BASE is only the host root. */
export function normalizeBaseURL(baseURL: string): string {
  let url = baseURL.trim().replace(/\/+$/, "");
  if (!/\/v\d+$/i.test(url)) {
    url = `${url}/v1`;
  }
  return url;
}

export function getImageModel(): string {
  return process.env.IMAGE_MODEL?.trim() || "gpt-image-2-c";
}

export function getVlmModel(): string {
  return process.env.VLM_MODEL?.trim() || "gpt-5";
}

export function createOpenAIClient(): OpenAI {
  const apiKey = requireEnv("VAPI_KEY");
  const baseURL = normalizeBaseURL(requireEnv("VAPI_BASE"));

  return new OpenAI({
    apiKey,
    baseURL,
  });
}
