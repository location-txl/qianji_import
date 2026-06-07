import type { AppConfig, CategoryRule, ExcludeRule, SourcePlatform } from "./types";

export const COMMON_ACCOUNT_OPTIONS:string[] = [];

export const DEFAULT_CONFIG: AppConfig = {
  accounts: [...COMMON_ACCOUNT_OPTIONS],
  paymentMethodMappings: {
    零钱: "微信",
    零钱通: "微信",
    余额宝: "支付宝",
  },
  sourceCategoryMappings: {},
  categoryRules: [],
  excludeRules: [],
};

const SOURCES = new Set<SourcePlatform | "all">(["all", "alipay", "wechat"]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} 必须是文本`);
  }
  return value.trim();
}

function validateMapping(value: unknown, field: string): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} 格式错误`);
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([rawKey, rawValue]) => {
      const key = rawKey.trim();
      const mappedValue = requireString(rawValue, `${field}.${key}`);
      return key && mappedValue ? [[key, mappedValue]] : [];
    }),
  );
}

function validateRule(value: unknown, index: number): CategoryRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`categoryRules[${index}] 格式错误`);
  }

  const rule = value as Record<string, unknown>;
  const id = requireString(rule.id, `categoryRules[${index}].id`);
  const source = requireString(rule.source, `categoryRules[${index}].source`);
  const keyword = requireString(rule.keyword ?? "", `categoryRules[${index}].keyword`);
  const startTime = requireString(rule.startTime ?? "", `categoryRules[${index}].startTime`);
  const endTime = requireString(rule.endTime ?? "", `categoryRules[${index}].endTime`);
  const category = requireString(rule.category, `categoryRules[${index}].category`);
  const subCategory = requireString(rule.subCategory ?? "", `categoryRules[${index}].subCategory`);

  if (!id || !SOURCES.has(source as SourcePlatform | "all")) {
    throw new Error(`categoryRules[${index}] 的来源无效`);
  }
  if (!category) {
    throw new Error(`categoryRules[${index}] 必须设置目标分类`);
  }
  if ((startTime && !TIME_PATTERN.test(startTime)) || (endTime && !TIME_PATTERN.test(endTime))) {
    throw new Error(`categoryRules[${index}] 时间必须是 HH:mm`);
  }

  return {
    id,
    source: source as SourcePlatform | "all",
    keyword,
    startTime,
    endTime,
    category,
    subCategory,
    ...((rule as Record<string, unknown>).aiLearned === true ? { aiLearned: true } : {}),
  };
}

function validateExcludeRule(value: unknown, index: number): ExcludeRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`excludeRules[${index}] 格式错误`);
  }

  const rule = value as Record<string, unknown>;
  const id = requireString(rule.id, `excludeRules[${index}].id`);
  const source = requireString(rule.source, `excludeRules[${index}].source`);
  const keyword = requireString(rule.keyword ?? "", `excludeRules[${index}].keyword`);
  const startTime = requireString(rule.startTime ?? "", `excludeRules[${index}].startTime`);
  const endTime = requireString(rule.endTime ?? "", `excludeRules[${index}].endTime`);

  if (!id || !SOURCES.has(source as SourcePlatform | "all")) {
    throw new Error(`excludeRules[${index}] 的来源无效`);
  }
  if ((startTime && !TIME_PATTERN.test(startTime)) || (endTime && !TIME_PATTERN.test(endTime))) {
    throw new Error(`excludeRules[${index}] 时间必须是 HH:mm`);
  }

  return {
    id,
    source: source as SourcePlatform | "all",
    keyword,
    startTime,
    endTime,
  };
}

/**
 * 校验并清理磁盘或接口收到的配置，避免错误配置影响下一次转换。
 *
 * @param value 接口请求体或配置文件读取出的未知数据。
 * @returns 可直接用于转换和持久化的配置。
 * @throws 输入结构、账户名或规则条件无效时抛错。
 */
export function parseAppConfig(value: unknown): AppConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("配置格式错误");
  }

  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.accounts)) {
    throw new Error("accounts 必须是数组");
  }

  const accounts = Array.from(
    new Set(input.accounts.map((entry, index) => requireString(entry, `accounts[${index}]`)).filter(Boolean)),
  );
  const paymentMethodMappings = validateMapping(
    input.paymentMethodMappings ?? {},
    "paymentMethodMappings",
  );
  const sourceCategoryMappings = validateMapping(
    input.sourceCategoryMappings ?? {},
    "sourceCategoryMappings",
  );
  const categoryRules = Array.isArray(input.categoryRules)
    ? input.categoryRules.map(validateRule)
    : (() => {
        throw new Error("categoryRules 必须是数组");
      })();

  const excludeRules = Array.isArray(input.excludeRules)
    ? input.excludeRules.map(validateExcludeRule)
    : [];

  const accountSet = new Set([...accounts, ...COMMON_ACCOUNT_OPTIONS]);
  Object.values(paymentMethodMappings).forEach((account) => accountSet.add(account));

  return {
    accounts: Array.from(accountSet),
    paymentMethodMappings,
    sourceCategoryMappings,
    categoryRules,
    excludeRules,
  };
}
