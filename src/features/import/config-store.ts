import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG, parseAppConfig } from "./config";
import type { AppConfig } from "./types";

export function defaultConfigPath(): string {
  return path.join(process.cwd(), "data", "config.json");
}

/**
 * 从本机配置文件读取转换设置，文件尚不存在时返回可立即使用的默认设置。
 *
 * @param configPath 配置文件位置；测试可以传入隔离目录。
 * @returns 经校验的配置。
 */
export async function readAppConfig(configPath = defaultConfigPath()): Promise<AppConfig> {
  try {
    return parseAppConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(DEFAULT_CONFIG);
    }
    throw error;
  }
}

/**
 * 以临时文件替换方式保存本地配置，避免写入中断留下半份 JSON。
 *
 * @param value 待保存且尚未信任的配置对象。
 * @param configPath 配置文件位置；测试可以传入隔离目录。
 * @returns 经清理后实际落盘的配置。
 */
export async function writeAppConfig(
  value: unknown,
  configPath = defaultConfigPath(),
): Promise<AppConfig> {
  const config = parseAppConfig(value);
  const directory = path.dirname(configPath);
  const temporaryPath = `${configPath}.${crypto.randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(temporaryPath, configPath);
  return config;
}
