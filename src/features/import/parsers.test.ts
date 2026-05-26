import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { getBasePaymentMethod, parseAlipayBuffer, parseWechatBuffer } from "./parsers";

const ALIPAY_GB18030_FIXTURE =
  "tbyz9tDFz6KjurLiytQKLS0tLS0tLS0tLS0tLS0tLQq9u9LXyrG85Cy9u9LXt9bA4Cy9u9LXttS3vSy21Le91cu6xSzJzMa3y7XD9yzK1S/Wpyy98LbuLMrVL7i2v+63vcq9LL270tfXtMysLL270te2qbWlusUsycy80raptaW6xSyxuNeiCjIwMjYtMDUtMDEgMDg6MzA6MDAsss3S+8PAyrMsvqm2q7HjwPu16iws1OeyzSzWp7P2LDEyLjUwLNPgtu6xpia67LD8LL270tezybmmLFQxLE0xLLLiytSxuNeiCg==";

describe("账单解析", () => {
  it("解码支付宝 GB18030 文件并跳过说明前导行", () => {
    const bytes = Uint8Array.from(Buffer.from(ALIPAY_GB18030_FIXTURE, "base64"));
    const rows = parseAlipayBuffer(bytes.buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredAt: "2026-05-01 08:30",
      sourceCategory: "餐饮美食",
      counterparty: "京东便利店",
      basePaymentMethod: "余额宝",
      amount: 12.5,
    });
  });

  it("定位微信工作簿表头并读取付款方式", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["微信支付账单"],
      ["导出说明"],
      ["交易时间", "交易类型", "交易对方", "商品", "收/支", "金额(元)", "支付方式", "当前状态", "交易单号", "商户单号", "备注"],
      ["2026-05-02 12:10:01", "商户消费", "便利店", "午餐", "支出", "18.90", "零钱通", "支付成功", "W1", "WM1", ""],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    expect(parseWechatBuffer(buffer)[0]).toMatchObject({
      source: "wechat",
      occurredAt: "2026-05-02 12:10",
      transactionKind: "商户消费",
      basePaymentMethod: "零钱通",
      amount: 18.9,
    });
  });

  it("从含优惠后缀的付款方式中取得实际资金源", () => {
    expect(getBasePaymentMethod("招商银行信用卡(1113)&碰一下立减")).toBe("招商银行信用卡(1113)");
  });
});
