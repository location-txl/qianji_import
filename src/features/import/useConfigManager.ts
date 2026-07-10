import { useEffect, useState } from "react";
import { DEFAULT_CONFIG, parseAppConfig } from "./config";
import type { AppConfig, MasterCategory } from "./types";

/**
 * 从已有的 sourceCategoryMappings 和 categoryRules 中提取分类，
 * 迁移生成 masterCategories（仅在 masterCategories 为空时执行）。
 */
export function migrateMasterCategories(config: AppConfig): { migrated: AppConfig; changed: boolean } {
  if (config.masterCategories.length > 0) {
    return { migrated: config, changed: false };
  }

  const categoryMap = new Map<string, Set<string>>();

  // 从 sourceCategoryMappings 值中提取（格式："一级分类/二级分类" 或 "一级分类"）
  for (const value of Object.values(config.sourceCategoryMappings)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("/");
    const category = parts[0].trim();
    if (!category) continue;
    if (!categoryMap.has(category)) categoryMap.set(category, new Set());
    if (parts.length > 1) {
      const sub = parts[1].trim();
      if (sub) categoryMap.get(category)!.add(sub);
    }
  }

  // 从 categoryRules 中提取
  for (const rule of config.categoryRules) {
    const category = rule.category.trim();
    if (!category) continue;
    if (!categoryMap.has(category)) categoryMap.set(category, new Set());
    if (rule.subCategory.trim()) {
      categoryMap.get(category)!.add(rule.subCategory.trim());
    }
  }

  if (categoryMap.size === 0) {
    return { migrated: config, changed: false };
  }

  const masterCategories: MasterCategory[] = Array.from(categoryMap.entries())
    .map(([category, subs]) => ({
      category,
      subCategories: Array.from(subs).sort((a, b) => a.localeCompare(b, "zh-CN")),
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "zh-CN"));

  return {
    migrated: { ...config, masterCategories },
    changed: true,
  };
}

export function useConfigManager() {
  const [config, setConfig] = useState<AppConfig>(structuredClone(DEFAULT_CONFIG));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "读取配置失败");
        }
        return parseAppConfig(payload);
      })
      .then((savedConfig) => {
        if (active) {
          const { migrated, changed } = migrateMasterCategories(savedConfig);
          setConfig(migrated);
          if (changed) {
            setDirty(true);
          }
        }
      })
      .catch((error: Error) => {
        if (active) {
          setMessage(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function updateConfig(next: AppConfig) {
    setConfig(next);
    setDirty(true);
    setMessage("");
  }

  async function saveConfig() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "配置保存失败");
      }
      setConfig(parseAppConfig(payload));
      setDirty(false);
      setMessage("配置已写入本机。");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return { config, dirty, saving, message, updateConfig, saveConfig };
}
