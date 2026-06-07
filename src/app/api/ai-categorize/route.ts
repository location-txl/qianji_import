import { NextResponse } from "next/server";
import { readAISettings } from "@/features/import/ai-store";
import type { AICategorySuggestion, AppConfig, NormalizedTransaction } from "@/features/import/types";

export const runtime = "nodejs";

interface RequestBody {
  transactions: NormalizedTransaction[];
  config: Pick<AppConfig, "categoryRules" | "sourceCategoryMappings">;
}

/**
 * 接收待分类交易列表，调用 OpenAI 兼容接口获取分类建议和关键字。
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const settings = await readAISettings();
    if (!settings.enabled) {
      return NextResponse.json({ message: "AI 分类未启用，请在设置中启用并配置 API Key。" }, { status: 400 });
    }
    if (!settings.apiKey) {
      return NextResponse.json({ message: "未配置 API Key，请在 AI 设置中填写。" }, { status: 400 });
    }

    const body: RequestBody = await request.json();
    if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // 限制单次请求量，避免 token 超限
    const transactions = body.transactions.slice(0, 50);

    const config = body.config ?? { categoryRules: [], sourceCategoryMappings: {} };
    const existingCategories = buildExistingCategories(config);
    const prompt = buildCategorizePrompt(transactions, existingCategories);

    const url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        { message: `AI 接口返回错误 (${response.status}): ${errorText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const completion = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ message: "AI 未返回有效内容。" }, { status: 502 });
    }

    const suggestions = parseSuggestions(content, transactions);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json({ message: "AI 请求超时，请稍后重试。" }, { status: 504 });
    }
    return NextResponse.json(
      { message: `AI 分类失败：${(error as Error).message}` },
      { status: 500 },
    );
  }
}

// ── Prompt 构造 ──

const SYSTEM_PROMPT = `你是一个中国个人记账分类助手。用户使用"钱迹"记账 App，你需要根据交易信息判断其应该归入的分类。

规则：
1. 参考用户已有的分类体系和规则习惯来分类
2. 如果已有规则能匹配，优先使用已有规则的分类
3. 为每条交易提取 1-3 个最短可独立匹配同类交易的关键词（中文，不含空格）
4. 关键词要求：能覆盖同类商户/场景的最短子串，例如"美团外卖"→"美团"，"瑞幸咖啡"→"瑞幸"，"星巴克"→"星巴克"
5. 不要使用过于宽泛的词如"支付""消费""转账"
6. 返回严格 JSON 格式`;

function buildExistingCategories(config: RequestBody["config"]): string {
  const parts: string[] = [];

  if (config.categoryRules.length > 0) {
    const rules = config.categoryRules.map(
      (r) => `  ${r.source === "all" ? "全部" : r.source === "alipay" ? "支付宝" : "微信"} | "${r.keyword}" → ${r.category}/${r.subCategory}`,
    );
    parts.push(`已有分类规则（按优先级排序）：\n${rules.join("\n")}`);
  }

  const mappings = Object.entries(config.sourceCategoryMappings);
  if (mappings.length > 0) {
    const lines = mappings.map(([key, value]) => `  ${key} → ${value}`);
    parts.push(`来源分类映射：\n${lines.join("\n")}`);
  }

  return parts.length > 0 ? `\n\n用户已有分类体系：\n${parts.join("\n\n")}` : "";
}

function buildCategorizePrompt(transactions: NormalizedTransaction[], existingCategories: string): string {
  const lines = transactions.map((t, index) => {
    return [
      `[${index}]`,
      `来源: ${t.source === "alipay" ? "支付宝" : "微信"}`,
      `商户: ${t.counterparty || "无"}`,
      `商品: ${t.item || "无"}`,
      `来源分类: ${t.sourceCategory || "无"}`,
      `金额: ${t.amount}`,
      `收支: ${t.direction}`,
      `时间: ${t.occurredAt}`,
    ].join(" | ");
  });

  return `请对以下 ${transactions.length} 条交易进行分类。${existingCategories}

交易列表：
${lines.join("\n")}

请返回 JSON 格式：
{
  "suggestions": [
    {
      "index": 0,
      "category": "一级分类",
      "subCategory": "二级分类（可为空字符串）",
      "keywords": ["关键词1", "关键词2"],
      "reasoning": "简要说明分类理由"
    }
  ]
}

要求：
- 每条交易都必须有对应的建议
- index 与交易列表的编号对应
- keywords 是能匹配同类交易的最短关键词数组（1-3个）
- 一级分类使用钱迹常见分类如：餐饮、交通、购物、娱乐、医疗、教育、居住、通讯、人情、工资、理财 等`;
}

// ── 响应解析 ──

function parseSuggestions(
  content: string,
  transactions: NormalizedTransaction[],
): AICategorySuggestion[] {
  let parsed: unknown;
  try {
    // 尝试提取 JSON（有时 AI 会包裹在 ```json ``` 中）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    throw new Error("AI 返回内容不是有效 JSON");
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>).suggestions)) {
    throw new Error("AI 返回的 JSON 缺少 suggestions 数组");
  }

  const raw = (parsed as { suggestions: unknown[] }).suggestions;
  const suggestions: AICategorySuggestion[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const index = typeof entry.index === "number" ? entry.index : -1;
    if (index < 0 || index >= transactions.length) continue;

    const category = typeof entry.category === "string" ? entry.category.trim() : "";
    if (!category) continue;

    suggestions.push({
      transactionId: transactions[index].id,
      category,
      subCategory: typeof entry.subCategory === "string" ? entry.subCategory.trim() : "",
      keywords: Array.isArray(entry.keywords)
        ? (entry.keywords as unknown[])
            .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
            .map((k) => k.trim())
            .slice(0, 3)
        : [],
      reasoning: typeof entry.reasoning === "string" ? entry.reasoning.trim() : "",
    });
  }

  return suggestions;
}
