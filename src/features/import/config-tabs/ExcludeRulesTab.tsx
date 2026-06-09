"use client";

import type { AppConfig, ExcludeRule } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface ExcludeRulesTabProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

export function ExcludeRulesTab({ config, onChange }: ExcludeRulesTabProps) {
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
    if (target < 0 || target >= config.excludeRules.length) return;
    const rules = [...config.excludeRules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    onChange({ ...config, excludeRules: rules });
  }

  function removeExcludeRule(id: string) {
    onChange({ ...config, excludeRules: config.excludeRules.filter((rule) => rule.id !== id) });
  }

  return (
    <>
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
    </>
  );
}
