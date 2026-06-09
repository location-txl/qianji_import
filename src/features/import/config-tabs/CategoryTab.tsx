"use client";

import { useMemo, useState } from "react";
import type { AppConfig, NormalizedTransaction, SourcePlatform } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ChevronUp, ChevronDown, Trash2, X } from "lucide-react";

function platformLabel(platform: SourcePlatform): string {
  return platform === "alipay" ? "支付宝" : "微信";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

interface CategoryTabProps {
  config: AppConfig;
  transactions: NormalizedTransaction[];
  onChange: (config: AppConfig) => void;
}

export function CategoryTab({ config, transactions, onChange }: CategoryTabProps) {
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newSubCategoryDrafts, setNewSubCategoryDrafts] = useState<Record<string, string>>({});

  const categoryKeys = useMemo(
    () =>
      unique([
        ...Object.keys(config.sourceCategoryMappings),
        ...transactions
          .filter((t) => t.sourceCategory)
          .map((t) => `${t.source}:${t.sourceCategory}`),
      ]),
    [config.sourceCategoryMappings, transactions],
  );

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

  function changeSourceCategoryMapping(key: string, value: string) {
    onChange({
      ...config,
      sourceCategoryMappings: { ...config.sourceCategoryMappings, [key]: value },
    });
  }

  return (
    <>
      {/* 分类总表 */}
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

      {/* 来源分类 → 钱迹分类 */}
      <div className="mt-5 border-t border-border pt-4">
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
                    onChange={(event) => changeSourceCategoryMapping(key, event.target.value)}
                    placeholder="一级分类/二级分类"
                    className="min-w-[130px] flex-1"
                  />
                </Field>
              );
            })}
          </FieldGroup>
        )}
      </div>
    </>
  );
}
