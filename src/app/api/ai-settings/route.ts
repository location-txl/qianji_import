import { NextResponse } from "next/server";
import { maskAISettings, readAISettings, writeAISettings } from "@/features/import/ai-store";

export const runtime = "nodejs";

/**
 * 返回 AI 连接设置，apiKey 脱敏。
 */
export async function GET(): Promise<NextResponse> {
  try {
    const settings = await readAISettings();
    return NextResponse.json(maskAISettings(settings));
  } catch (error) {
    return NextResponse.json(
      { message: `AI 设置读取失败：${(error as Error).message}` },
      { status: 500 },
    );
  }
}

/**
 * 保存 AI 连接设置到 data/ai-settings.json。
 *
 * 请求体中 apiKey 如果是脱敏形式（只含 • 和后 4 位），则保留原值不覆盖。
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const incoming = (await request.json()) as Record<string, unknown>;
    // 如果 apiKey 是脱敏的（全为 • 或 • + 后 4 位），不覆盖
    if (typeof incoming.apiKey === "string" && /^\*+[^*]*$/.test(incoming.apiKey)) {
      const existing = await readAISettings();
      if (existing.apiKey.slice(-4) === incoming.apiKey.slice(-4)) {
        incoming.apiKey = existing.apiKey;
      }
    }
    const settings = await writeAISettings(incoming);
    return NextResponse.json(maskAISettings(settings));
  } catch (error) {
    return NextResponse.json(
      { message: `AI 设置保存失败：${(error as Error).message}` },
      { status: 400 },
    );
  }
}
