"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, Check } from "lucide-react";

interface AiToolbarProps {
  visible: boolean;
  loading: boolean;
  error: string;
  suggestionCount: number;
  targetCount: number;
  onRun: () => void;
  onAdoptAll: () => void;
}

export function AiToolbar({
  visible,
  loading,
  error,
  suggestionCount,
  targetCount,
  onRun,
  onAdoptAll,
}: AiToolbarProps) {
  if (!visible) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-sm border border-[#ddd5f0] bg-[#f8f5ff] p-[11px_12px]">
      <Button
        variant="outline"
        type="button"
        onClick={onRun}
        disabled={loading || targetCount === 0}
        className="gap-1.5"
      >
        <Sparkles className={cn("size-4", loading && "animate-pulse")} />
        {loading ? "AI 分析中..." : "AI 分析未分类"}
      </Button>
      {suggestionCount > 0 && (
        <Button
          variant="outline"
          type="button"
          onClick={onAdoptAll}
          className="gap-1.5"
        >
          <Check className="size-4" />
          采纳全部 AI 建议 ({suggestionCount})
        </Button>
      )}
      {error && (
        <span className="ml-2 text-sm text-destructive">{error}</span>
      )}
      {!loading && suggestionCount === 0 && targetCount > 0 && !error && (
        <span className="text-xs text-muted-foreground">
          AI 可自动识别可导出中未分类交易的分类并提取关键词
        </span>
      )}
    </div>
  );
}
