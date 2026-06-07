"use client";

import { cn } from "@/lib/utils";

interface StatsBarProps {
  totalCount: number;
  readyCount: number;
  pendingCount: number;
  duplicateCount: number;
  totalAmount: number;
}

export function StatsBar({ totalCount, readyCount, pendingCount, duplicateCount, totalAmount }: StatsBarProps) {
  return (
    <div className="mb-5 grid grid-cols-5 gap-2.5">
      {[
        { label: "载入记录", value: totalCount },
        { label: "可导出", value: readyCount },
        { label: "待处理", value: pendingCount, warn: pendingCount > 0 },
        { label: "重复", value: duplicateCount, warn: duplicateCount > 0 },
        { label: "导出金额合计", value: `¥ ${totalAmount.toFixed(2)}` },
      ].map(({ label, value, warn }) => (
        <div
          key={label}
          className={cn(
            "border-l-3 border-primary bg-[#faf6ee] p-[15px_17px]",
            warn && "border-accent bg-warning",
          )}
        >
          <span className="block text-xs text-muted-foreground">{label}</span>
          <strong className="mt-1.5 block font-mono text-2xl font-semibold">{value}</strong>
        </div>
      ))}
    </div>
  );
}
