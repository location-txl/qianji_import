import { NextResponse } from "next/server";
import { readAppConfig, writeAppConfig } from "@/features/import/config-store";

export const runtime = "nodejs";

/**
 * 返回本机保存的账户及分类规则；首次访问时返回默认建议配置。
 */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await readAppConfig());
  } catch (error) {
    return NextResponse.json(
      { message: `本地配置读取失败：${(error as Error).message}` },
      { status: 500 },
    );
  }
}

/**
 * 校验后以原子替换方式将配置写入本机文件，不接收任何账单明细。
 *
 * @param request 含 AppConfig JSON 的本地网页请求。
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const config = await writeAppConfig(await request.json());
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { message: `配置保存失败：${(error as Error).message}` },
      { status: 400 },
    );
  }
}
