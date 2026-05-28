"use client";

import { useMemo, useState } from "react";
import { COMMON_ACCOUNT_OPTIONS } from "./config";
import type { AppConfig, CategoryRule, ExcludeRule, NormalizedTransaction, SourcePlatform } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, Trash2, X } from "lucide-react";

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
          subCategory: "",
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

  function addExcludeRule() {
    onChange({
      ...config,
      excludeRules: [
        ...config.excludeRules,
        {
          id: crypto.randomUUID(),
          source: "all",
          keyword: "",
          startTime: "",
          endTime: "",
        },
      ],
    });
  }

  function updateExcludeRule(id: string, patch: Partial<ExcludeRule>) {
    onChange({
      ...config,
      excludeRules: config.excludeRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  }

  function moveExcludeRule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= config.excludeRules.length) {
      return;
    }
    const rules = [...config.excludeRules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    onChange({ ...config, excludeRules: rules });
  }

  function removeExcludeRule(id: string) {
    onChange({ ...config, excludeRules: config.excludeRules.filter((rule) => rule.id !== id) });
  }

  return (
    <>
      <DialogHeader>
        <div>
          <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-accent">02 / 映射规则</p>
          <DialogTitle className="font-title text-2xl">账户与分类</DialogTitle>
        </div>
        <DialogDescription className="font-mono text-xs">
          配置仅写入本机 <code>data/config.json</code>，不会保存上传账单或预览明细。
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
        {message && (
          <div className="mb-4 rounded-sm bg-primary/5 p-2.5 text-sm text-primary">{message}</div>
        )}

        {/* 钱迹账户 */}
        <div className="border-t border-border py-4">
          <h3 className="mb-3 text-sm font-bold">钱迹账户</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {config.accounts.map((account) => (
              <Badge variant="secondary" key={account} className="gap-1 rounded-full px-2.5 py-1 text-sm">
                {account}
                {!COMMON_ACCOUNT_OPTIONS.includes(account) && (
                  <button
                    type="button"
                    onClick={() => removeAccount(account)}
                    aria-label={`移除账户 ${account}`}
                    className="ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={accountDraft}
              onChange={(event) => setAccountDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addAccount()}
              placeholder="新增账户，如 招商信用卡"
              className="min-w-0 flex-1"
            />
            <Button variant="outline" type="button" onClick={addAccount}>
              添加
            </Button>
          </div>
        </div>

        {/* 付款方式 → 账户 */}
        <div className="border-t border-border py-4">
          <h3 className="mb-3 text-sm font-bold">付款方式 → 账户</h3>
          {paymentMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">上传账单后，将在这里列出实际资金来源。</p>
          ) : (
            <FieldGroup className="gap-2">
              {paymentMethods.map((method, index) => (
                <Field key={method} orientation="horizontal" className="items-center gap-2">
                  <FieldLabel
                    htmlFor={`payment-method-mapping-${index}`}
                    className="min-w-[112px] flex-1 truncate text-xs text-muted-foreground"
                    title={method}
                  >
                    {method || "未提供"}
                  </FieldLabel>
                  <Input
                    id={`payment-method-mapping-${index}`}
                    list="account-options"
                    value={config.paymentMethodMappings[method] ?? ""}
                    onChange={(event) => changeMapping("paymentMethodMappings", method, event.target.value)}
                    placeholder="选择或输入账户"
                    className="min-w-[130px] flex-1"
                  />
                </Field>
              ))}
            </FieldGroup>
          )}
        </div>

        {/* 来源分类 → 钱迹分类 */}
        <div className="border-t border-border py-4">
          <h3 className="mb-1 text-sm font-bold">来源分类 → 钱迹分类</h3>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            用 <code className="font-mono">/</code> 分隔一级和二级分类，如 <code className="font-mono">餐饮/早餐</code>。
          </p>
          {categoryKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">支付宝分类会在上传后出现；微信可通过下方规则分类。</p>
          ) : (
            <FieldGroup className="gap-2">
              {categoryKeys.map((key, index) => {
                const [source, category] = key.split(":");
                return (
                  <Field key={key} orientation="horizontal" className="items-center gap-2">
                    <FieldLabel
                      htmlFor={`source-category-mapping-${index}`}
                      className="min-w-[112px] flex-1 truncate text-xs text-muted-foreground"
                    >
                      {platformLabel(source as SourcePlatform)} / {category}
                    </FieldLabel>
                    <Input
                      id={`source-category-mapping-${index}`}
                      value={config.sourceCategoryMappings[key] ?? ""}
                      onChange={(event) => changeMapping("sourceCategoryMappings", key, event.target.value)}
                      placeholder="一级分类/二级分类"
                      className="min-w-[130px] flex-1"
                    />
                  </Field>
                );
              })}
            </FieldGroup>
          )}
        </div>

        {/* 自动分类规则 */}
        <div className="border-t border-border py-4">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold">自动分类规则</h3>
            <Button variant="ghost" size="sm" type="button" onClick={addRule} className="text-accent">
              + 新规则
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            按顺序首个匹配生效，例如商户包含{'"'}京东便利店{'"'}且时间在 06:00-10:00，一级分类{'"'}三餐{'"'}、二级分类{'"'}早餐{'"'}。
          </p>
          <div className="flex flex-col gap-2.5">
            {config.categoryRules.map((rule, index) => (
              <div className="rounded-sm border border-border bg-[#fbf7ef] p-2.5" key={rule.id}>
                <div className="mb-2 flex items-center gap-1">
                  <span className="mr-auto font-mono text-xs text-accent">{String(index + 1).padStart(2, "0")}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => moveRule(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp data-icon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => moveRule(index, 1)}
                    disabled={index === config.categoryRules.length - 1}
                  >
                    <ChevronDown data-icon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    className="text-destructive"
                  >
                    <Trash2 data-icon />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <select
                    value={rule.source}
                    onChange={(event) => updateRule(rule.id, { source: event.target.value as CategoryRule["source"] })}
                    className="h-[34px] rounded-sm border border-input bg-white px-2 text-sm"
                  >
                    <option value="all">全部来源</option>
                    <option value="alipay">支付宝</option>
                    <option value="wechat">微信</option>
                  </select>
                  <Input
                    value={rule.keyword}
                    onChange={(event) => updateRule(rule.id, { keyword: event.target.value })}
                    placeholder="商户/商品关键词"
                  />
                  <div className="col-span-3 grid grid-cols-4 gap-1.5">
                    <Input type="time" value={rule.startTime} onChange={(event) => updateRule(rule.id, { startTime: event.target.value })} />
                    <Input type="time" value={rule.endTime} onChange={(event) => updateRule(rule.id, { endTime: event.target.value })} />
                    <Input
                      value={rule.category}
                      onChange={(event) => updateRule(rule.id, { category: event.target.value })}
                      placeholder="一级分类"
                    />
                    <Input
                      value={rule.subCategory}
                      onChange={(event) => updateRule(rule.id, { subCategory: event.target.value })}
                      placeholder="二级分类（可选）"
                    />
                  </div>
                </div>
              </div>
            ))}
            {config.categoryRules.length === 0 && (
              <p className="text-xs text-muted-foreground leading-relaxed">尚未添加条件规则，来源分类映射仍会照常应用。</p>
            )}
          </div>
        </div>

        {/* 排除规则 */}
        <div className="border-t border-border py-4">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold">排除规则</h3>
            <Button variant="ghost" size="sm" type="button" onClick={addExcludeRule} className="text-accent">
              + 新规则
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            匹配到这些关键字的交易将自动排除，不出现在预览中。支持来源和时间段筛选。
          </p>
          <div className="flex flex-col gap-2.5">
            {config.excludeRules.map((rule, index) => (
              <div className="rounded-sm border border-border bg-[#fbf7ef] p-2.5" key={rule.id}>
                <div className="mb-2 flex items-center gap-1">
                  <span className="mr-auto font-mono text-xs text-accent">{String(index + 1).padStart(2, "0")}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => moveExcludeRule(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp data-icon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => moveExcludeRule(index, 1)}
                    disabled={index === config.excludeRules.length - 1}
                  >
                    <ChevronDown data-icon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => removeExcludeRule(rule.id)}
                    className="text-destructive"
                  >
                    <Trash2 data-icon />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <select
                    value={rule.source}
                    onChange={(event) => updateExcludeRule(rule.id, { source: event.target.value as ExcludeRule["source"] })}
                    className="h-[34px] rounded-sm border border-input bg-white px-2 text-sm"
                  >
                    <option value="all">全部来源</option>
                    <option value="alipay">支付宝</option>
                    <option value="wechat">微信</option>
                  </select>
                  <Input
                    value={rule.keyword}
                    onChange={(event) => updateExcludeRule(rule.id, { keyword: event.target.value })}
                    placeholder="商户/商品关键词"
                  />
                  <Input type="time" value={rule.startTime} onChange={(event) => updateExcludeRule(rule.id, { startTime: event.target.value })} />
                  <Input type="time" value={rule.endTime} onChange={(event) => updateExcludeRule(rule.id, { endTime: event.target.value })} />
                </div>
              </div>
            ))}
            {config.excludeRules.length === 0 && (
              <p className="text-xs text-muted-foreground leading-relaxed">尚未添加排除规则，所有交易将正常参与分类。</p>
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <div className="flex items-center gap-3">
          {message && <span className="text-sm text-primary">{message}</span>}
          <Button disabled={!dirty || saving} onClick={onSave}>
            {saving ? "保存中" : dirty ? "保存配置" : "已保存"}
          </Button>
        </div>
      </DialogFooter>

      <datalist id="account-options">
        {accountOptions.map((account) => <option key={account} value={account} />)}
      </datalist>
    </>
  );
}
