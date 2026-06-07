import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AISettings } from "./types";

const DEFAULT_AI_SETTINGS: AISettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  enabled: false,
};

export function aiSettingsPath(): string {
  return path.join(process.cwd(), "data", "ai-settings.json");
}

/**
 * 读取 AI 设置，文件不存在时返回默认值。
 */
export async function readAISettings(configPath = aiSettingsPath()): Promise<AISettings> {
  try {
    return parseAISettings(JSON.parse(await readFile(configPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(DEFAULT_AI_SETTINGS);
    }
    throw error;
  }
}

/**
 * 原子写入 AI 设置到磁盘。
 */
export async function writeAISettings(
  value: unknown,
  configPath = aiSettingsPath(),
): Promise<AISettings> {
  const settings = parseAISettings(value);
  const directory = path.dirname(configPath);
  const temporaryPath = `${configPath}.${crypto.randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await rename(temporaryPath, configPath);
  return settings;
}

/**
 * 脱敏返回设置，apiKey 只显示后 4 位。
 */
export function maskAISettings(settings: AISettings): AISettings {
  if (!settings.apiKey) return settings;
  const masked = "*".repeat(Math.max(0, settings.apiKey.length - 4)) + settings.apiKey.slice(-4);
  return { ...settings, apiKey: masked };
}

function parseAISettings(value: unknown): AISettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 设置格式错误");
  }
  const input = value as Record<string, unknown>;
  return {
    baseUrl: typeof input.baseUrl === "string" ? input.baseUrl.trim() || DEFAULT_AI_SETTINGS.baseUrl : DEFAULT_AI_SETTINGS.baseUrl,
    apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : "",
    model: typeof input.model === "string" ? input.model.trim() || DEFAULT_AI_SETTINGS.model : DEFAULT_AI_SETTINGS.model,
    enabled: Boolean(input.enabled),
  };
}
