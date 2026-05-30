import * as XLSX from "xlsx";
import type { ExistingQianjiRecord, NormalizedTransaction, SourcePlatform } from "./types";

type SourceRecord = Record<string, string>;

function normalizeValue(value: unknown): string {
  return String(value ?? "").trim();
}

function parseAmount(value: string): number {
  return parseOptionalAmount(value) ?? 0;
}

function parseOptionalAmount(value: string): number | null {
  const normalized = value.replace(/[¥￥,\s]/g, "");
  if (!normalized) {
    return null;
  }
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function formatDateTime(value: string): string {
  const matched = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!matched) {
    return value;
  }
  const [, year, month, day, hour = "00", minute = "00"] = matched;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${hour.padStart(2, "0")}:${minute}`;
}

export function getBasePaymentMethod(paymentMethod: string): string {
  return paymentMethod.split("&")[0].trim();
}

function recordsFromMatrix(matrix: unknown[][], headerIndex: number): SourceRecord[] {
  const headers = matrix[headerIndex].map(normalizeValue);
  return matrix.slice(headerIndex + 1).flatMap((row) => {
    const record = Object.fromEntries(
      headers.flatMap((header, index) => (header ? [[header, normalizeValue(row[index])]] : [])),
    );
    return Object.values(record).some(Boolean) ? [record] : [];
  });
}

function createTransaction(
  source: SourcePlatform,
  sourceRow: number,
  row: SourceRecord,
): NormalizedTransaction {
  const isAlipay = source === "alipay";
  const paymentMethod = row[isAlipay ? "收/付款方式" : "支付方式"] ?? "";
  const kind = row[isAlipay ? "交易分类" : "交易类型"] ?? "";
  const tradeNo = row[isAlipay ? "交易订单号" : "交易单号"] ?? "";

  return {
    id: `${source}-${sourceRow}-${tradeNo || row[isAlipay ? "商家订单号" : "商户单号"] || kind}`,
    source,
    sourceRow,
    occurredAt: formatDateTime(row["交易时间"] ?? ""),
    sourceCategory: isAlipay ? kind : "",
    transactionKind: kind,
    direction: row["收/支"] ?? "",
    amount: parseAmount(row[isAlipay ? "金额" : "金额(元)"] ?? ""),
    paymentMethod,
    basePaymentMethod: getBasePaymentMethod(paymentMethod),
    status: row[isAlipay ? "交易状态" : "当前状态"] ?? "",
    counterparty: row["交易对方"] ?? "",
    item: row[isAlipay ? "商品说明" : "商品"] ?? "",
    tradeNo,
    merchantNo: row[isAlipay ? "商家订单号" : "商户单号"] ?? "",
    originalNote: row["备注"] ?? "",
  };
}

/**
 * 解析支付宝下载的 CSV 文本。支付宝文件包含说明前导行，因此必须先定位真实表头。
 *
 * @param text 已按支付宝导出编码解码的完整文件文本。
 * @returns 可进入统一转换流程的支付宝交易。
 * @throws 找不到支付宝账单表头时抛错。
 */
export function parseAlipayText(text: string): NormalizedTransaction[] {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => line.includes("交易时间") && line.includes("交易分类") && line.includes("收/付款方式"),
  );
  if (headerIndex < 0) {
    throw new Error("未找到支付宝账单表头，请上传支付宝交易明细 CSV");
  }

  const workbook = XLSX.read(lines.slice(headerIndex).join("\n"), { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  return recordsFromMatrix(matrix, 0).map((row, index) => createTransaction("alipay", headerIndex + index + 2, row));
}

/**
 * 解码并解析支付宝导出的 GB18030 CSV 字节。
 *
 * @param data 浏览器读取到的账单文件内容。
 * @returns 标准化支付宝交易列表。
 */
export function parseAlipayBuffer(data: ArrayBuffer): NormalizedTransaction[] {
  return parseAlipayText(new TextDecoder("gb18030").decode(data));
}

/**
 * 解析微信支付 XLSX，通过字段而非固定行号寻找账单数据区。
 *
 * @param data 浏览器读取到的工作簿内容。
 * @returns 标准化微信交易列表。
 * @throws 找不到微信账单表头时抛错。
 */
export function parseWechatBuffer(data: ArrayBuffer): NormalizedTransaction[] {
  const workbook = XLSX.read(data, { type: "array", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headerIndex = matrix.findIndex((row) => {
    const values = row.map(normalizeValue);
    return values.includes("交易时间") && values.includes("交易类型") && values.includes("支付方式");
  });
  if (headerIndex < 0) {
    throw new Error("未找到微信账单表头，请上传微信支付账单 XLSX");
  }

  return recordsFromMatrix(matrix, headerIndex).map((row, index) =>
    createTransaction("wechat", headerIndex + index + 2, row),
  );
}

/**
 * 解析钱迹导出的已有账单 CSV，只保留能参与去重的时间、金额和账户字段。
 *
 * @param data 浏览器读取到的钱迹 CSV 文件内容。
 * @returns 可用于本次导入去重的已有钱迹记录。
 * @throws 找不到钱迹账单表头时抛错。
 */
export function parseQianjiExistingCsvBuffer(data: ArrayBuffer): ExistingQianjiRecord[] {
  const text = new TextDecoder("utf-8").decode(data).replace(/^\uFEFF/, "");
  const workbook = XLSX.read(text, { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = matrix.findIndex((row) => {
    const values = row.map(normalizeValue);
    return values.includes("时间") && values.includes("金额") && values.includes("账户1");
  });
  if (headerIndex < 0) {
    throw new Error("未找到钱迹账单表头，请上传钱迹导出的 CSV");
  }

  return recordsFromMatrix(matrix, headerIndex).flatMap((row, index) => {
    const occurredAt = formatDateTime(row["时间"] ?? "");
    const amount = parseOptionalAmount(row["金额"] ?? "");
    const account = normalizeValue(row["账户1"]);
    if (!occurredAt || amount === null || !account) {
      return [];
    }
    return [{
      id: normalizeValue(row.ID),
      sourceRow: headerIndex + index + 2,
      occurredAt,
      amount,
      account,
    }];
  });
}
