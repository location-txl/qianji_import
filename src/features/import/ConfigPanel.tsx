"use client";

import { useMemo, useState } from "react";
import { COMMON_ACCOUNT_OPTIONS } from "./config";
import type { AppConfig, CategoryRule, NormalizedTransaction, SourcePlatform } from "./types";
import styles from "./import-workbench.module.css";

/**
 * 配置区属性，父组件负责持久化和触发重新转换。
 */
interface ConfigPanelProps {
  config: AppConfig;
  transactions: NormalizedTransaction[];
  dirty: boolean;
  saving: boolean;
  message: string;
  onChange: (config: AppConfig) => void;
  onSave: () => void;
}

function platformLabel(platform: SourcePlatform): string {
  return platform === "alipay" ? "支付宝" : "微信";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

/**
 * 编辑仅落盘为配置 JSON 的账户映射和分类规则，不接触原始账单文件。
 */
export function ConfigPanel({
  config,
  transactions,
  dirty,
  saving,
  message,
  onChange,
  onSave,
}: ConfigPanelProps) {
  const [accountDraft, setAccountDraft] = useState("");
  const paymentMethods = useMemo(
    () =>
      unique([
        ...Object.keys(config.paymentMethodMappings),
        ...transactions.map((transaction) => transaction.basePaymentMethod),
      ]),
    [config.paymentMethodMappings, transactions],
  );
  const categoryKeys = useMemo(
    () =>
      unique([
        ...Object.keys(config.sourceCategoryMappings),
        ...transactions
          .filter((transaction) => transaction.sourceCategory)
          .map((transaction) => `${transaction.source}:${transaction.sourceCategory}`),
      ]),
    [config.sourceCategoryMappings, transactions],
  );
  const accountOptions = unique([...COMMON_ACCOUNT_OPTIONS, ...config.accounts]);

  function changeMapping(field: "paymentMethodMappings" | "sourceCategoryMappings", key: string, value: string) {
    onChange({
      ...config,
      [field]: { ...config[field], [key]: value },
    });
  }

  function addAccount() {
    const account = accountDraft.trim();
    if (!account) {
      return;
    }
    onChange({ ...config, accounts: unique([...config.accounts, account]) });
    setAccountDraft("");
  }

  function removeAccount(account: string) {
    onChange({ ...config, accounts: config.accounts.filter((candidate) => candidate !== account) });
  }

  function addRule() {
    onChange({
      ...config,
      categoryRules: [
        ...config.categoryRules,
        {
          id: crypto.randomUUID(),
          source: "all",
          keyword: "",
          startTime: "",
          endTime: "",
          category: "",
        },
      ],
    });
  }

  function updateRule(id: string, patch: Partial<CategoryRule>) {
    onChange({
      ...config,
      categoryRules: config.categoryRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  }

  function moveRule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= config.categoryRules.length) {
      return;
    }
    const rules = [...config.categoryRules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    onChange({ ...config, categoryRules: rules });
  }

  function removeRule(id: string) {
    onChange({ ...config, categoryRules: config.categoryRules.filter((rule) => rule.id !== id) });
  }

  return (
    <section className={`${styles.panel} ${styles.configPanel}`}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>02 / 映射规则</p>
          <h2>账户与分类</h2>
        </div>
        <button className={styles.primaryButton} type="button" disabled={!dirty || saving} onClick={onSave}>
          {saving ? "保存中" : dirty ? "保存配置" : "已保存"}
        </button>
      </div>
      <p className={styles.helper}>配置仅写入本机 <code>data/config.json</code>，不会保存上传账单或预览明细。</p>
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.configBlock}>
        <h3>钱迹账户</h3>
        <div className={styles.tagRow}>
          {config.accounts.map((account) => (
            <span className={styles.tag} key={account}>
              {account}
              {!COMMON_ACCOUNT_OPTIONS.includes(account) && (
                <button type="button" onClick={() => removeAccount(account)} aria-label={`移除账户 ${account}`}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className={styles.inlineEntry}>
          <input
            value={accountDraft}
            onChange={(event) => setAccountDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addAccount()}
            placeholder="新增账户，如 招商信用卡"
          />
          <button className={styles.secondaryButton} type="button" onClick={addAccount}>
            添加
          </button>
        </div>
      </div>

      <div className={styles.configBlock}>
        <h3>付款方式 → 账户</h3>
        {paymentMethods.length === 0 ? (
          <p className={styles.emptyHint}>上传账单后，将在这里列出实际资金来源。</p>
        ) : (
          <div className={styles.mappingList}>
            {paymentMethods.map((method) => (
              <label className={styles.mappingRow} key={method}>
                <span title={method}>{method || "未提供"}</span>
                <input
                  list="account-options"
                  value={config.paymentMethodMappings[method] ?? ""}
                  onChange={(event) => changeMapping("paymentMethodMappings", method, event.target.value)}
                  placeholder="选择或输入账户"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.configBlock}>
        <h3>来源分类 → 钱迹分类</h3>
        {categoryKeys.length === 0 ? (
          <p className={styles.emptyHint}>支付宝分类会在上传后出现；微信可通过下方规则分类。</p>
        ) : (
          <div className={styles.mappingList}>
            {categoryKeys.map((key) => {
              const [source, category] = key.split(":");
              return (
                <label className={styles.mappingRow} key={key}>
                  <span>{platformLabel(source as SourcePlatform)} / {category}</span>
                  <input
                    value={config.sourceCategoryMappings[key] ?? ""}
                    onChange={(event) => changeMapping("sourceCategoryMappings", key, event.target.value)}
                    placeholder="钱迹分类"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.configBlock}>
        <div className={styles.blockTitle}>
          <h3>自动分类规则</h3>
          <button className={styles.textButton} type="button" onClick={addRule}>+ 新规则</button>
        </div>
        <p className={styles.helper}>按顺序首个匹配生效，例如商户包含“京东便利店”且时间在 06:00-10:00，分类为“三餐”。</p>
        <div className={styles.ruleList}>
          {config.categoryRules.map((rule, index) => (
            <div className={styles.ruleCard} key={rule.id}>
              <div className={styles.ruleControls}>
                <span className={styles.ruleIndex}>{String(index + 1).padStart(2, "0")}</span>
                <button type="button" onClick={() => moveRule(index, -1)} disabled={index === 0}>↑</button>
                <button type="button" onClick={() => moveRule(index, 1)} disabled={index === config.categoryRules.length - 1}>↓</button>
                <button type="button" onClick={() => removeRule(rule.id)}>删除</button>
              </div>
              <div className={styles.ruleGrid}>
                <select
                  value={rule.source}
                  onChange={(event) => updateRule(rule.id, { source: event.target.value as CategoryRule["source"] })}
                >
                  <option value="all">全部来源</option>
                  <option value="alipay">支付宝</option>
                  <option value="wechat">微信</option>
                </select>
                <input
                  value={rule.keyword}
                  onChange={(event) => updateRule(rule.id, { keyword: event.target.value })}
                  placeholder="商户/商品关键词"
                />
                <input type="time" value={rule.startTime} onChange={(event) => updateRule(rule.id, { startTime: event.target.value })} />
                <input type="time" value={rule.endTime} onChange={(event) => updateRule(rule.id, { endTime: event.target.value })} />
                <input
                  value={rule.category}
                  onChange={(event) => updateRule(rule.id, { category: event.target.value })}
                  placeholder="目标分类"
                />
              </div>
            </div>
          ))}
          {config.categoryRules.length === 0 && (
            <p className={styles.emptyHint}>尚未添加条件规则，来源分类映射仍会照常应用。</p>
          )}
        </div>
      </div>
      <datalist id="account-options">
        {accountOptions.map((account) => <option key={account} value={account} />)}
      </datalist>
    </section>
  );
}
