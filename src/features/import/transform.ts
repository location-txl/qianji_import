import type {
  AppConfig,
  CategoryRule,
  NormalizedTransaction,
  PreviewRow,
  QianjiTemplateRow,
  RowIssue,
  RowOverride,
  TemplateType,
} from "./types";

const ALLOWED_TYPES = new Set<TemplateType>(["收入", "支出", "报销", "转账", "还款"]);

function emptyTemplateRow(): QianjiTemplateRow {
  return {
    时间: "",
    分类: "",
    二级分类: "",
    类型: "",
    金额: "",
    账户1: "",
    账户2: "",
    备注: "",
    账单图片: "",
    账单标记: "",
    手续费: "",
    优惠券: "",
    标签: "",
  };
}

function amountText(amount: number): string {
  return amount.toFixed(2);
}

function noteFor(transaction: NormalizedTransaction): string {
  const source = transaction.source === "alipay" ? "支付宝" : "微信";
  return [source, transaction.counterparty, transaction.item, transaction.originalNote]
    .filter(Boolean)
    .join(" | ");
}

function isTimeInRange(time: string, startTime: string, endTime: string): boolean {
  if (!startTime && !endTime) {
    return true;
  }
  if (startTime && !endTime) {
    return time >= startTime;
  }
  if (!startTime && endTime) {
    return time <= endTime;
  }
  if (startTime <= endTime) {
    return time >= startTime && time <= endTime;
  }
  return time >= startTime || time <= endTime;
}

function matchesRule(transaction: NormalizedTransaction, rule: CategoryRule): boolean {
  if (rule.source !== "all" && rule.source !== transaction.source) {
    return false;
  }
  const searchableText = `${transaction.counterparty} ${transaction.item}`;
  if (rule.keyword && !searchableText.includes(rule.keyword)) {
    return false;
  }
  return isTimeInRange(transaction.occurredAt.slice(11, 16), rule.startTime, rule.endTime);
}

function resolveCategory(transaction: NormalizedTransaction, config: AppConfig): { category: string; subCategory: string } {
  const rule = config.categoryRules.find(
    (candidate) => candidate.category && matchesRule(transaction, candidate),
  );
  if (rule) {
    return { category: rule.category, subCategory: rule.subCategory };
  }
  const mapped = config.sourceCategoryMappings[`${transaction.source}:${transaction.sourceCategory}`] ?? "";
  const parts = mapped.split("/");
  return { category: parts[0]?.trim() ?? "", subCategory: parts[1]?.trim() ?? "" };
}

function inferType(transaction: NormalizedTransaction): TemplateType | "" {
  return transaction.direction === "收入" || transaction.direction === "支出"
    ? transaction.direction
    : "";
}

function isRefund(transaction: NormalizedTransaction): boolean {
  if (transaction.source === "wechat") {
    return /退款|退还/.test(`${transaction.transactionKind} ${transaction.status}`);
  }
  return /退款/.test(`${transaction.transactionKind} ${transaction.status}`);
}

function isManualOnlyWechatTransaction(transaction: NormalizedTransaction): boolean {
  return transaction.source === "wechat" && /转账|红包|零钱通/.test(transaction.transactionKind);
}

function isAutoSuccess(transaction: NormalizedTransaction): boolean {
  const allowedStatuses =
    transaction.source === "alipay" ? new Set(["交易成功", "支付成功"]) : new Set(["支付成功"]);
  return allowedStatuses.has(transaction.status) && ["收入", "支出"].includes(transaction.direction);
}

function addIssue(issues: Map<string, RowIssue[]>, id: string, issue: RowIssue): void {
  const existing = issues.get(id) ?? [];
  if (!existing.some((item) => item.code === issue.code && item.message === issue.message)) {
    issues.set(id, [...existing, issue]);
  }
}

function collectSpecialIssues(transactions: NormalizedTransaction[]): Map<string, RowIssue[]> {
  const issues = new Map<string, RowIssue[]>();

  transactions.filter(isRefund).forEach((refund) => {
    addIssue(issues, refund.id, {
      code: "refund_pending",
      message: "退款不属于钱迹模板支持类型，请人工处理后再纳入导出。",
    });

    if (refund.source !== "alipay") {
      return;
    }

    const linked = refund.merchantNo
      ? transactions.filter(
          (candidate) =>
            candidate.source === "alipay" &&
            candidate.id !== refund.id &&
            candidate.merchantNo === refund.merchantNo &&
            !isRefund(candidate),
        )
      : [];

    if (linked.length === 1) {
      addIssue(issues, linked[0].id, {
        code: "refund_pending",
        message: "该支付宝支出关联退款，请人工确认是否仍需导入。",
      });
    } else {
      addIssue(issues, refund.id, {
        code: "refund_pair_review",
        message: "未能唯一关联原支出，请在钱迹中人工复核退款影响。",
      });
    }
  });

  transactions.filter(isManualOnlyWechatTransaction).forEach((transaction) => {
    addIssue(issues, transaction.id, {
      code: "transfer_pending",
      message: "转账、红包或零钱通移动按约定需要人工处理。",
    });
  });

  return issues;
}

function validateTemplate(template: QianjiTemplateRow): RowIssue[] {
  const missing = [
    !template.时间 && "时间",
    !template.类型 && "类型",
    !template.金额 && "金额",
    !template.账户1 && "账户1",
  ].filter(Boolean);

  if (missing.length > 0) {
    return [{ code: "invalid_template", message: `钱迹必需字段未补齐：${missing.join("、")}` }];
  }
  if (!ALLOWED_TYPES.has(template.类型 as TemplateType)) {
    return [{ code: "invalid_template", message: "类型必须是收入、支出、报销、转账或还款。" }];
  }
  if (!Number.isFinite(Number(template.金额)) || Number(template.金额) < 0) {
    return [{ code: "invalid_template", message: "金额必须是有效的非负数字。" }];
  }
  if ((template.类型 === "转账" || template.类型 === "还款") && !template.账户2) {
    return [{ code: "invalid_template", message: "转账或还款必须补充账户2。" }];
  }
  return [];
}

/**
 * 将来源账单转换为可编辑的钱迹预览行，并把不能自动判定的记录留作人工处理。
 *
 * @param transactions 已标准化的支付宝和微信交易。
 * @param config 当前本机账户及分类规则配置。
 * @param overrides 用户在当前页面对预览结果进行的覆盖编辑。
 * @returns 按来源记录顺序排列的预览和导出判定。
 */
export function buildPreviewRows(
  transactions: NormalizedTransaction[],
  config: AppConfig,
  overrides: Record<string, RowOverride> = {},
  dateFilter?: { from?: string; to?: string },
): PreviewRow[] {
  const filtered = transactions.filter((t) => {
    const date = t.occurredAt.slice(0, 10);
    if (dateFilter?.from && date < dateFilter.from) return false;
    if (dateFilter?.to && date > dateFilter.to) return false;
    return true;
  });

  const specialIssues = collectSpecialIssues(transactions);

  return filtered.map((transaction) => {
    const { category, subCategory } = resolveCategory(transaction, config);
    const template: QianjiTemplateRow = {
      ...emptyTemplateRow(),
      时间: transaction.occurredAt,
      分类: category,
      二级分类: subCategory,
      类型: inferType(transaction),
      金额: amountText(transaction.amount),
      账户1: config.paymentMethodMappings[transaction.basePaymentMethod] ?? "",
      备注: noteFor(transaction),
    };
    const automaticIssues = [...(specialIssues.get(transaction.id) ?? [])];

    if (!isAutoSuccess(transaction) && automaticIssues.length === 0) {
      automaticIssues.push({
        code: "invalid_status",
        message: `状态“${transaction.status || "空"}”或收支方向不支持自动导出。`,
      });
    }
    if (!template.账户1) {
      automaticIssues.push({
        code: "missing_account_mapping",
        message: `付款方式“${transaction.basePaymentMethod || "未提供"}”尚未配置钱迹账户。`,
      });
    }

    const override = overrides[transaction.id];
    const editedTemplate = { ...template, ...(override?.fields ?? {}) };
    const validationIssues = validateTemplate(editedTemplate);
    const excluded = override?.include === false;
    const canExport =
      !excluded &&
      validationIssues.length === 0 &&
      (automaticIssues.length === 0 || override?.include === true);
    const issues = excluded
      ? [{ code: "excluded_by_user" as const, message: "已由用户从本次导出中排除。" }]
      : [...automaticIssues, ...validationIssues];

    return {
      id: transaction.id,
      source: transaction.source,
      transaction,
      template: editedTemplate,
      issues,
      canExport,
      manuallyIncluded: override?.include === true,
      manuallyEdited: Boolean(override),
    };
  });
}
