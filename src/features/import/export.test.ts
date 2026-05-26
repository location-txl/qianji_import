import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { createQianjiCsv } from "./export";
import { buildPreviewRows } from "./transform";
import type { NormalizedTransaction } from "./types";

describe("钱迹 CSV 导出", () => {
  it("固定输出官方表头、转义中文备注并忽略待处理行", () => {
    const ready: NormalizedTransaction = {
      id: "alipay-1",
      source: "alipay",
      sourceRow: 1,
      occurredAt: "2026-05-01 10:30",
      sourceCategory: "",
      transactionKind: "餐饮美食",
      direction: "支出",
      amount: 20,
      paymentMethod: "余额宝",
      basePaymentMethod: "余额宝",
      status: "交易成功",
      counterparty: "店铺,一号",
      item: '"午餐"',
      tradeNo: "1",
      merchantNo: "1",
      originalNote: "",
    };
    const pending = { ...ready, id: "alipay-2", status: "交易关闭" };
    const csv = createQianjiCsv(buildPreviewRows([ready, pending], DEFAULT_CONFIG));

    expect(csv).toContain("时间,分类,二级分类,类型,金额,账户1,账户2,备注,账单图片,账单标记,手续费,优惠券,标签");
    expect(csv).toContain('"支付宝 | 店铺,一号 | ""午餐"""');
    expect(csv.match(/2026-05-01/g)).toHaveLength(1);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
