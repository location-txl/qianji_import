"use client";

import { useEffect, useMemo, useState } from "react";
import { COMMON_ACCOUNT_OPTIONS } from "./config";
import type { AISettings, AppConfig, CategoryRule, ExcludeRule, MasterCategory, NormalizedTransaction, SourcePlatform } from "./types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, Trash2, X, Sparkles } from "lucide-react";

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
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newSubCategoryDrafts, setNewSubCategoryDrafts] = useState<Record<string, string>>({});
  const [aiForm, setAiForm] = useState<AISettings>({
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    enabled: false,
  });
  const [aiDirty, setAiDirty] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/ai-settings")
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) throw new Error(payload.message ?? "读取 AI 设置失败");
        return payload as AISettings;
      })
      .then((settings) => {
        if (active) setAiForm(settings);
      })
      .catch((err: Error) => {
        if (active) setAiMessage(err.message);
      });
    return () => { active = false; };
  }, []);

  function updateAiForm(patch: Partial<AISettings>) {
    setAiForm((current) => ({ ...current, ...patch }));
    setAiDirty(true);
    setAiMessage("");
  }

  async function saveAiSettings() {
    setAiSaving(true);
    setAiMessage("");
    try {
      const response = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "保存失败");
      setAiForm(payload as AISettings);
      setAiDirty(false);
      setAiMessage("AI 设置已保存。");
    } catch (err) {
      setAiMessage((err as Error).message);
    } finally {
      setAiSaving(false);
    }
  }

  async function testAiConnection() {
    setAiTesting(true);
    setAiMessage("");
    try {
      const response = await fetch("/api/ai-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: [{
            id: "test",
            source: "alipay",
            sourceRow: 1,
            occurredAt: "2024-01-01 12:00:00",
            sourceCategory: "餐饮美食",
            transactionKind: "即时到账交易",
            direction: "支出",
            amount: 25,
            paymentMethod: "",
            basePaymentMethod: "",
            status: "交易成功",
            counterparty: "测试商户",
            item: "测试商品",
            tradeNo: "",
            merchantNo: "",
            originalNote: "",
          }],
          config: { categoryRules: [], sourceCategoryMappings: {} },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "连接失败");
      setAiMessage(`连接成功！模型 ${aiForm.model} 正常响应。`);
    } catch (err) {
      setAiMessage(`测试失败：${(err as Error).message}`);
    } finally {
      setAiTesting(false);
    }
  }
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

  // ── 分类总表管理 ──

  function addMasterCategory() {
    const name = newCategoryDraft.trim();
    if (!name || config.masterCategories.some((c) => c.category === name)) return;
    onChange({ ...config, masterCategories: [...config.masterCategories, { category: name, subCategories: [] }] });
    setNewCategoryDraft("");
  }

  function removeMasterCategory(category: string) {
    onChange({
      ...config,
      masterCategories: config.masterCategories.filter((c) => c.category !== category),
    });
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.delete(category);
      return next;
    });
  }

  function toggleExpandCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function addSubCategory(category: string) {
    const sub = (newSubCategoryDrafts[category] ?? "").trim();
    if (!sub) return;
    onChange({
      ...config,
      masterCategories: config.masterCategories.map((c) =>
        c.category === category && !c.subCategories.includes(sub)
          ? { ...c, subCategories: [...c.subCategories, sub] }
          : c,
      ),
    });
    setNewSubCategoryDrafts((prev) => ({ ...prev, [category]: "" }));
  }

  function removeSubCategory(category: string, sub: string) {
    onChange({
      ...config,
      masterCategories: config.masterCategories.map((c) =>
        c.category === category
          ? { ...c, subCategories: c.subCategories.filter((s) => s !== sub) }
          : c,
      ),
    });
  }

  const masterCategoryNames = config.masterCategories.map((c) => c.category);

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

        {/* 分类总表 */}
        <div className="border-t border-border py-4">
          <h3 className="mb-3 text-sm font-bold">分类总表</h3>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            所有来源分类映射、自动分类规则和 AI 分类都从此列表中选取一级和二级分类。
          </p>
          <div className="mb-3 flex flex-col gap-1.5">
            {config.masterCategories.map((mc) => (
              <div key={mc.category} className="rounded-sm border border-border bg-[#fbf7ef]">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => toggleExpandCategory(mc.category)}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    aria-label={expandedCategories.has(mc.category) ? "折叠" : "展开"}
                  >
                    {expandedCategories.has(mc.category) ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronUp className="size-3.5 rotate-90" />
                    )}
                  </button>
                  <span className="flex-1 text-sm font-medium">{mc.category}</span>
                  {mc.subCategories.length > 0 && (
                    <span className="text-xs text-muted-foreground">{mc.subCategories.length} 个二级分类</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMasterCategory(mc.category)}
                    aria-label={`移除分类 ${mc.category}`}
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {expandedCategories.has(mc.category) && (
                  <div className="border-t border-border/60 px-5 pb-2 pt-1.5">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {mc.subCategories.map((sub) => (
                        <Badge variant="secondary" key={sub} className="gap-1 rounded-full px-2 py-0.5 text-xs">
                          {sub}
                          <button
                            type="button"
                            onClick={() => removeSubCategory(mc.category, sub)}
                            aria-label={`移除二级分类 ${sub}`}
                            className="ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                      {mc.subCategories.length === 0 && (
                        <span className="text-xs text-muted-foreground">暂无二级分类</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newSubCategoryDrafts[mc.category] ?? ""}
                        onChange={(event) => setNewSubCategoryDrafts((prev) => ({ ...prev, [mc.category]: event.target.value }))}
                        onKeyDown={(event) => event.key === "Enter" && addSubCategory(mc.category)}
                        placeholder="新增二级分类"
                        className="min-w-0 flex-1 h-8 text-xs"
                      />
                      <Button variant="outline" size="sm" type="button" onClick={() => addSubCategory(mc.category)}>
                        添加
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {config.masterCategories.length === 0 && (
              <p className="text-xs text-muted-foreground leading-relaxed">尚未添加分类，点击下方添加或从现有规则迁移。</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newCategoryDraft}
              onChange={(event) => setNewCategoryDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addMasterCategory()}
              placeholder="新增一级分类，如 餐饮"
              className="min-w-0 flex-1"
            />
            <Button variant="outline" type="button" onClick={addMasterCategory}>
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
                      list="master-category-options"
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
              <div className={cn("rounded-sm border border-border bg-[#fbf7ef] p-2.5", rule.aiLearned && "border-[#ddd5f0] bg-[#f8f5ff]")} key={rule.id}>
                <div className="mb-2 flex items-center gap-1">
                  <span className="mr-auto font-mono text-xs text-accent">{String(index + 1).padStart(2, "0")}</span>
                  {rule.aiLearned && (
                    <Badge variant="secondary" className="mr-1 rounded-sm px-1.5 py-0 text-[10px]">AI</Badge>
                  )}
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
                      list="master-category-options"
                      placeholder="一级分类"
                    />
                    <Input
                      value={rule.subCategory}
                      onChange={(event) => updateRule(rule.id, { subCategory: event.target.value })}
                      list="master-subcategory-options"
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

        {/* AI 智能分类设置 */}
        <div className="border-t border-border py-4">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <h3 className="text-sm font-bold">AI 智能分类</h3>
            {aiForm.enabled && (
              <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">已启用</Badge>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            接入 OpenAI 兼容接口，AI 可自动识别待处理交易的分类并提取关键词生成规则。
          </p>
          <div className="flex flex-col gap-2">
            <Field orientation="horizontal" className="items-center gap-2">
              <FieldLabel htmlFor="ai-enabled" className="min-w-[80px] text-xs">启用 AI</FieldLabel>
              <input
                id="ai-enabled"
                type="checkbox"
                checked={aiForm.enabled}
                onChange={(event) => updateAiForm({ enabled: event.target.checked })}
                className="size-4"
              />
            </Field>
            <Field orientation="horizontal" className="items-center gap-2">
              <FieldLabel htmlFor="ai-base-url" className="min-w-[80px] text-xs">API 地址</FieldLabel>
              <Input
                id="ai-base-url"
                value={aiForm.baseUrl}
                onChange={(event) => updateAiForm({ baseUrl: event.target.value })}
                placeholder="https://api.openai.com/v1"
                className="flex-1 font-mono text-xs"
              />
            </Field>
            <Field orientation="horizontal" className="items-center gap-2">
              <FieldLabel htmlFor="ai-api-key" className="min-w-[80px] text-xs">API Key</FieldLabel>
              <Input
                id="ai-api-key"
                type="password"
                value={aiForm.apiKey}
                onChange={(event) => updateAiForm({ apiKey: event.target.value })}
                placeholder="sk-..."
                className="flex-1 font-mono text-xs"
              />
            </Field>
            <Field orientation="horizontal" className="items-center gap-2">
              <FieldLabel htmlFor="ai-model" className="min-w-[80px] text-xs">模型</FieldLabel>
              <Input
                id="ai-model"
                value={aiForm.model}
                onChange={(event) => updateAiForm({ model: event.target.value })}
                placeholder="gpt-4o-mini"
                className="flex-1 font-mono text-xs"
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={testAiConnection}
                disabled={aiTesting || !aiForm.apiKey}
              >
                {aiTesting ? "测试中..." : "测试连接"}
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={saveAiSettings}
                disabled={!aiDirty || aiSaving}
              >
                {aiSaving ? "保存中" : aiDirty ? "保存 AI 设置" : "已保存"}
              </Button>
              {aiMessage && (
                <span className={cn(
                  "text-xs",
                  aiMessage.includes("成功") || aiMessage.includes("已保存") ? "text-[#44816f]" : "text-destructive",
                )}>
                  {aiMessage}
                </span>
              )}
            </div>
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
      <datalist id="master-category-options">
        {masterCategoryNames.map((cat) => <option key={cat} value={cat} />)}
      </datalist>
      <datalist id="master-subcategory-options">
        {config.masterCategories.flatMap((mc) => mc.subCategories).filter((v, i, a) => a.indexOf(v) === i).sort((l, r) => l.localeCompare(r, "zh-CN")).map((sub) => <option key={sub} value={sub} />)}
      </datalist>
    </>
  );
}
