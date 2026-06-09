"use client";

import type { AppConfig, CategoryRule } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface CategoryRulesTabProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

export function CategoryRulesTab({ config, onChange }: CategoryRulesTabProps) {
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
    if (target < 0 || target >= config.categoryRules.length) return;
    const rules = [...config.categoryRules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    onChange({ ...config, categoryRules: rules });
  }

  function removeRule(id: string) {
    onChange({ ...config, categoryRules: config.categoryRules.filter((rule) => rule.id !== id) });
  }

  return (
    <>
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
    </>
  );
}
