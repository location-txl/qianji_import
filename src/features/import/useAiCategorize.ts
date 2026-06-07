import { useState } from "react";
import type { AICategorySuggestion, AppConfig, NormalizedTransaction, PreviewRow, RowOverride } from "./types";

export function useAiCategorize(
  config: AppConfig,
  transactions: NormalizedTransaction[],
  aiTargetRows: PreviewRow[],
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, RowOverride>>>,
  updateConfig: (next: AppConfig) => void,
) {
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AICategorySuggestion>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const aiSuggestionCount = Object.keys(aiSuggestions).length;

  function learnRulesFromSuggestions(suggestionMap: Record<string, AICategorySuggestion>) {
    const existingSignatures = new Set(
      config.categoryRules.map((r) => `${r.source}|${r.keyword}`),
    );
    const newRules: typeof config.categoryRules = [];

    for (const [id, suggestion] of Object.entries(suggestionMap)) {
      if (!suggestion.keywords.length) continue;
      const tx = transactions.find((t) => t.id === id);
      if (!tx) continue;

      for (const keyword of suggestion.keywords) {
        const sig = `${tx.source}|${keyword}`;
        if (existingSignatures.has(sig)) continue;
        existingSignatures.add(sig);
        newRules.push({
          id: crypto.randomUUID(),
          source: tx.source,
          keyword,
          startTime: "",
          endTime: "",
          category: suggestion.category,
          subCategory: suggestion.subCategory,
          aiLearned: true,
        });
      }
    }

    if (newRules.length > 0) {
      updateConfig({
        ...config,
        categoryRules: [...config.categoryRules, ...newRules],
      });
    }
  }

  function adoptAiSuggestion(id: string) {
    const suggestion = aiSuggestions[id];
    if (!suggestion) return;
    setOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        fields: {
          ...(current[id]?.fields ?? {}),
          分类: suggestion.category,
          ...(suggestion.subCategory ? { 二级分类: suggestion.subCategory } : {}),
        },
        include: true,
      },
    }));
    learnRulesFromSuggestions({ [id]: suggestion });
  }

  function dismissAiSuggestion(id: string) {
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function adoptAllAiSuggestions() {
    setOverrides((current) => {
      const next = { ...current };
      for (const [id, suggestion] of Object.entries(aiSuggestions)) {
        next[id] = {
          ...next[id],
          fields: {
            ...(next[id]?.fields ?? {}),
            分类: suggestion.category,
            ...(suggestion.subCategory ? { 二级分类: suggestion.subCategory } : {}),
          },
          include: true,
        };
      }
      return next;
    });
    learnRulesFromSuggestions(aiSuggestions);
  }

  async function runAiCategorize() {
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/ai-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: aiTargetRows.map((row) => row.transaction),
          config: {
            categoryRules: config.categoryRules,
            sourceCategoryMappings: config.sourceCategoryMappings,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "AI 分析失败");
      }
      const suggestions = payload.suggestions as AICategorySuggestion[];
      setAiSuggestions((current) => {
        const next = { ...current };
        for (const s of suggestions) {
          next[s.transactionId] = s;
        }
        return next;
      });
    } catch (error) {
      setAiError((error as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  return {
    aiSuggestions,
    aiLoading,
    aiError,
    aiSuggestionCount,
    adoptAiSuggestion,
    dismissAiSuggestion,
    adoptAllAiSuggestions,
    runAiCategorize,
  };
}
