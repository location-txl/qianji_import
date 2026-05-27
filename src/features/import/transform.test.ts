import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { buildPreviewRows } from "./transform";
import type { AppConfig, NormalizedTransaction } from "./types";

function transaction(patch: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    id: "alipay-1-A",
    source: "alipay",
    sourceRow: 1,
    occurredAt: "2026-05-01 08:30",
    sourceCategory: "餐饮美食",
    transactionKind: "餐饮美食",
    direction: "支出",
    amount: 12.5,
    paymentMethod: "余额宝",
    basePaymentMethod: "余额宝",
    status: "交易成功",
    counterparty: "京东便利店",
    item: "早餐",
    tradeNo: "A",
    merchantNo: "M1",
    originalNote: "",
    ...patch,
  };
}

const config: AppConfig = {
  ...structuredClone(DEFAULT_CONFIG),
  sourceCategoryMappings: { "alipay:餐饮美食": "日常餐饮" },
  categoryRules: [
    {
      id: "morning-store",
      source: "alipay",
      keyword: "京东便利店",
      startTime: "06:00",
      endTime: "10:00",
      category: "三餐",
    },
  ],
};

describe("钱迹预览转换", () => {
  it("条件规则覆盖来源分类映射，并按实际资金源选择账户", () => {
    const row = buildPreviewRows([transaction()], config)[0];

    expect(row.canExport).toBe(true);
    expect(row.template).toMatchObject({
      分类: "三餐",
      类型: "支出",
      金额: "12.50",
      账户1: "支付宝",
    });
  });

  it("银行卡未映射时保留为待处理", () => {
    const row = buildPreviewRows(
      [transaction({ basePaymentMethod: "招商银行信用卡(1113)", paymentMethod: "招商银行信用卡(1113)" })],
      config,
    )[0];

    expect(row.canExport).toBe(false);
    expect(row.issues.map((issue) => issue.code)).toContain("missing_account_mapping");
  });

  it("支付宝退款及唯一关联原支出都不默认导出", () => {
    const original = transaction();
    const refund = transaction({
      id: "alipay-2-R",
      sourceRow: 2,
      direction: "不计收支",
      transactionKind: "退款",
      sourceCategory: "退款",
      status: "退款成功",
      tradeNo: "R",
    });
    const rows = buildPreviewRows([original, refund], config);

    expect(rows.every((row) => !row.canExport)).toBe(true);
    expect(rows[0].issues.map((issue) => issue.code)).toContain("refund_pending");
    expect(rows[1].issues.map((issue) => issue.code)).toContain("refund_pending");
  });

  it("微信退款与转账均需人工纳入，人工补齐后可导出", () => {
    const refund = transaction({
      id: "wechat-1-R",
      source: "wechat",
      transactionKind: "商户消费-退款",
      sourceCategory: "",
      direction: "收入",
      status: "已全额退款",
      paymentMethod: "零钱",
      basePaymentMethod: "零钱",
    });
    const transfer = transaction({
      id: "wechat-2-T",
      source: "wechat",
      transactionKind: "转账",
      sourceCategory: "",
      status: "对方已收钱",
      paymentMethod: "零钱",
      basePaymentMethod: "零钱",
    });
    const pending = buildPreviewRows([refund, transfer], config);
    const manuallyIncluded = buildPreviewRows([refund], config, {
      [refund.id]: { include: true, fields: { 类型: "收入" } },
    })[0];

    expect(pending.map((row) => row.issues[0].code)).toEqual(["refund_pending", "transfer_pending"]);
    expect(manuallyIncluded.canExport).toBe(true);
  });
});

describe("日期范围过滤", () => {
  it("from 排除早于该日期的交易", () => {
    const early = transaction({ id: "early", occurredAt: "2026-04-15 10:00" });
    const late = transaction({ id: "late", occurredAt: "2026-05-10 10:00" });
    const rows = buildPreviewRows([early, late], config, {}, { from: "2026-05-01" });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("late");
  });

  it("to 排除晚于该日期的交易", () => {
    const early = transaction({ id: "early", occurredAt: "2026-04-15 10:00" });
    const late = transaction({ id: "late", occurredAt: "2026-05-10 10:00" });
    const rows = buildPreviewRows([early, late], config, {}, { to: "2026-04-30" });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("early");
  });

  it("from 和 to 同时设置时形成闭区间", () => {
    const before = transaction({ id: "before", occurredAt: "2026-04-30 23:59" });
    const inside1 = transaction({ id: "inside1", occurredAt: "2026-05-01 00:00" });
    const inside2 = transaction({ id: "inside2", occurredAt: "2026-05-31 23:59" });
    const after = transaction({ id: "after", occurredAt: "2026-06-01 00:00" });
    const rows = buildPreviewRows([before, inside1, inside2, after], config, {}, { from: "2026-05-01", to: "2026-05-31" });
    expect(rows.map((r) => r.id)).toEqual(["inside1", "inside2"]);
  });

  it("未设置日期范围时不过滤", () => {
    const early = transaction({ id: "early", occurredAt: "2020-01-01 00:00" });
    const late = transaction({ id: "late", occurredAt: "2030-12-31 23:59" });
    const rows = buildPreviewRows([early, late], config);
    expect(rows).toHaveLength(2);
  });

  it("过滤在退款关联检查之前执行", () => {
    const original = transaction({ occurredAt: "2026-04-10 08:00" });
    const refund = transaction({
      id: "alipay-2-R",
      sourceRow: 2,
      direction: "不计收支",
      transactionKind: "退款",
      sourceCategory: "退款",
      status: "退款成功",
      tradeNo: "R",
      occurredAt: "2026-04-10 09:00",
    });
    const rows = buildPreviewRows([original, refund], config, {}, { from: "2026-05-01" });
    expect(rows).toHaveLength(0);
  });
});
