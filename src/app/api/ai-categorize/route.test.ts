import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NormalizedTransaction } from "@/features/import/types";

// Mock ai-store
vi.mock("@/features/import/ai-store", () => ({
  readAISettings: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeTransaction(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    id: "test-1",
    source: "alipay",
    sourceRow: 1,
    occurredAt: "2024-01-15 12:00:00",
    sourceCategory: "餐饮美食",
    transactionKind: "即时到账交易",
    direction: "支出",
    amount: 25.5,
    paymentMethod: "招商银行信用卡(1113)",
    basePaymentMethod: "招商银行信用卡(1113)",
    status: "交易成功",
    counterparty: "美团外卖",
    item: "麻辣香锅",
    tradeNo: "202401150001",
    merchantNo: "M001",
    originalNote: "",
    ...overrides,
  };
}

function makeAIResponse(suggestions: unknown[]) {
  return {
    choices: [{ message: { content: JSON.stringify({ suggestions }) } }],
  };
}

describe("POST /api/ai-categorize", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { readAISettings } = await import("@/features/import/ai-store");
    vi.mocked(readAISettings).mockResolvedValue({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-key",
      model: "gpt-4o-mini",
      enabled: true,
    });
  });

  async function callRoute(transactions: NormalizedTransaction[], config?: Record<string, unknown>) {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/ai-categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactions,
        config: config ?? { categoryRules: [], sourceCategoryMappings: {}, masterCategories: [] },
      }),
    });
    return POST(request);
  }

  it("returns suggestions for valid transactions", async () => {
    const tx = makeTransaction();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeAIResponse([
          { index: 0, category: "餐饮", subCategory: "外卖", keywords: ["美团"], reasoning: "外卖平台" },
        ]),
    });

    const response = await callRoute([tx]);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].transactionId).toBe("test-1");
    expect(body.suggestions[0].category).toBe("餐饮");
    expect(body.suggestions[0].keywords).toEqual(["美团"]);
  });

  it("returns empty when transactions is empty", async () => {
    const response = await callRoute([]);
    const body = await response.json();
    expect(body.suggestions).toEqual([]);
  });

  it("returns 400 when AI is disabled", async () => {
    const { readAISettings } = await import("@/features/import/ai-store");
    vi.mocked(readAISettings).mockResolvedValue({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      enabled: false,
    });

    const response = await callRoute([makeTransaction()]);
    expect(response.status).toBe(400);
  });

  it("returns 502 when AI returns error status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });

    const response = await callRoute([makeTransaction()]);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.message).toContain("429");
  });

  it("handles JSON wrapped in markdown code block", async () => {
    const tx = makeTransaction();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '```json\n{"suggestions":[{"index":0,"category":"餐饮","subCategory":"","keywords":["美团"],"reasoning":"外卖"}]}\n```',
            },
          },
        ],
      }),
    });

    const response = await callRoute([tx]);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.suggestions[0].category).toBe("餐饮");
  });

  it("sends existing rules in prompt to AI", async () => {
    const tx = makeTransaction();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeAIResponse([{ index: 0, category: "餐饮", subCategory: "", keywords: ["美团"], reasoning: "" }]),
    });

    await callRoute([tx], {
      categoryRules: [{ id: "1", source: "all", keyword: "美团", startTime: "", endTime: "", category: "餐饮", subCategory: "外卖" }],
      sourceCategoryMappings: { "alipay:餐饮美食": "餐饮/正餐" },
      masterCategories: [{ category: "餐饮", subCategories: ["外卖", "正餐"] }],
    });

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toContain("美团");
    expect(userMessage).toContain("餐饮/外卖");
    expect(userMessage).toContain("餐饮/正餐");
    expect(userMessage).toContain("可用分类列表");
    expect(userMessage).toContain("餐饮：外卖、正餐");
  });

  it("skips invalid entries in AI response", async () => {
    const tx = makeTransaction();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeAIResponse([
          { index: 99, category: "餐饮", subCategory: "", keywords: [], reasoning: "" }, // invalid index
          { index: 0, category: "", subCategory: "", keywords: [], reasoning: "" }, // empty category
          "not an object",
          { index: 0, category: "购物", subCategory: "日用", keywords: ["超市"], reasonin: "" },
        ]),
    });

    const response = await callRoute([tx]);
    const body = await response.json();
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].category).toBe("购物");
  });
});
