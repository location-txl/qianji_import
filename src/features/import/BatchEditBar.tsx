"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BatchEdit } from "./utils";

interface BatchEditBarProps {
  batch: BatchEdit;
  selectedCount: number;
  onBatchChange: (batch: BatchEdit) => void;
  onApply: () => void;
  onInclude: () => void;
  onExclude: () => void;
  onClearSelection: () => void;
}

export function BatchEditBar({
  batch,
  selectedCount,
  onBatchChange,
  onApply,
  onInclude,
  onExclude,
  onClearSelection,
}: BatchEditBarProps) {
  return (
    <div className="mb-3 grid grid-cols-[auto_repeat(4,minmax(105px,1fr))_auto_auto_auto_auto] items-center gap-[7px] rounded-sm border border-[#e7dece] bg-[#f8f3eb] p-[11px_12px]">
      <strong className="mr-1.5 whitespace-nowrap text-[13px]">
        批量处理 {selectedCount ? `(${selectedCount})` : ""}
      </strong>
      <Input list="master-category-options" value={batch.分类} onChange={(event) => onBatchChange({ ...batch, 分类: event.target.value })} placeholder="分类" />
      <select name="batch-type" aria-label="批量设置类型" value={batch.类型} onChange={(event) => onBatchChange({ ...batch, 类型: event.target.value })} className="h-[34px] rounded-sm border border-input bg-white px-2 text-sm">
        <option value="">类型不改</option>
        <option value="收入">收入</option>
        <option value="支出">支出</option>
        <option value="报销">报销</option>
        <option value="转账">转账</option>
        <option value="还款">还款</option>
      </select>
      <Input list="account-options" value={batch.账户1} onChange={(event) => onBatchChange({ ...batch, 账户1: event.target.value })} placeholder="账户1" />
      <Input value={batch.备注} onChange={(event) => onBatchChange({ ...batch, 备注: event.target.value })} placeholder="备注" />
      <Button variant="outline" type="button" disabled={!selectedCount} onClick={onApply}>应用字段</Button>
      <Button variant="outline" type="button" disabled={!selectedCount} onClick={onInclude}>纳入导出</Button>
      <Button variant="ghost" size="sm" type="button" disabled={!selectedCount} onClick={onExclude} className="text-accent">排除</Button>
      <Button variant="ghost" size="sm" type="button" disabled={!selectedCount} onClick={onClearSelection} className="text-accent">清除选中</Button>
    </div>
  );
}
