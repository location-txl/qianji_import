/**
 * 钱迹官方模板允许导入的列，顺序必须与导出 CSV 保持一致。
 */
export const QIANJI_HEADERS = [
  "时间",
  "分类",
  "二级分类",
  "类型",
  "金额",
  "账户1",
  "账户2",
  "备注",
  "账单图片",
  "账单标记",
  "手续费",
  "优惠券",
  "标签",
] as const;

export type QianjiHeader = (typeof QIANJI_HEADERS)[number];
export type SourcePlatform = "alipay" | "wechat";
export type TemplateType = "收入" | "支出" | "报销" | "转账" | "还款";

/**
 * 自动分类规则，仅负责把符合条件的来源账单映射到钱迹分类。
 */
export interface CategoryRule {
  id: string;
  source: SourcePlatform | "all";
  keyword: string;
  startTime: string;
  endTime: string;
  category: string;
}

/**
 * 本机持久化配置；账单明细和编辑草稿不会写入该结构。
 */
export interface AppConfig {
  accounts: string[];
  paymentMethodMappings: Record<string, string>;
  sourceCategoryMappings: Record<string, string>;
  categoryRules: CategoryRule[];
}

/**
 * 两个支付平台解析后的统一交易表示，保留原始定位信息用于复核问题行。
 */
export interface NormalizedTransaction {
  id: string;
  source: SourcePlatform;
  sourceRow: number;
  occurredAt: string;
  sourceCategory: string;
  transactionKind: string;
  direction: string;
  amount: number;
  paymentMethod: string;
  basePaymentMethod: string;
  status: string;
  counterparty: string;
  item: string;
  tradeNo: string;
  merchantNo: string;
  originalNote: string;
}

export type RowIssueCode =
  | "refund_pending"
  | "refund_pair_review"
  | "transfer_pending"
  | "missing_account_mapping"
  | "invalid_status"
  | "invalid_template"
  | "excluded_by_user";

/**
 * 无法默认写入钱迹模板的原因；所有问题均需要在预览区显式呈现。
 */
export interface RowIssue {
  code: RowIssueCode;
  message: string;
}

export type QianjiTemplateRow = Record<QianjiHeader, string>;

/**
 * 用户在预览表内产生的覆盖项，include 表示是否明确纳入或排除导出。
 */
export interface RowOverride {
  fields?: Partial<QianjiTemplateRow>;
  include?: boolean;
}

/**
 * 预览区展示的一行，包含目标模板内容、来源交易和导出判定。
 */
export interface PreviewRow {
  id: string;
  source: SourcePlatform;
  transaction: NormalizedTransaction;
  template: QianjiTemplateRow;
  issues: RowIssue[];
  canExport: boolean;
  manuallyIncluded: boolean;
  manuallyEdited: boolean;
}
