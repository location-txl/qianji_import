"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DuplicateConfirmGroup } from "./utils";
import { sourceLabel } from "./utils";

interface DuplicateConfirmDialogProps {
  open: boolean;
  group: DuplicateConfirmGroup | null;
  selection: Set<string>;
  onOpenChange: (open: boolean) => void;
  onSelectCandidate: (id: string, checked: boolean) => void;
  onResolve: (duplicateIds: Set<string>) => void;
}

export function DuplicateConfirmDialog({
  open,
  group,
  selection,
  onOpenChange,
  onSelectCandidate,
  onResolve,
}: DuplicateConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>确认疑似重复账单</DialogTitle>
          <DialogDescription>
            钱迹已有 {group?.existingCount ?? 0} 条同时间、金额、账户记录；本次匹配到 {group?.rows.length ?? 0} 条候选。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 overflow-auto pr-1">
          {group?.rows.map((row) => {
            const checked = selection.has(row.id);
            const limitReached = selection.size >= group.existingCount;
            return (
              <label
                key={row.id}
                className={cn(
                  "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-sm border border-border bg-card p-3 transition-colors hover:bg-muted/40",
                  checked && "border-accent bg-warning",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={!checked && limitReached}
                  onCheckedChange={(value) => onSelectCandidate(row.id, value === true)}
                  aria-label={`标记 ${sourceLabel(row.source)} 第 ${row.transaction.sourceRow} 行为重复`}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{sourceLabel(row.source)}</Badge>
                    <Badge variant="outline">来源第 {row.transaction.sourceRow} 行</Badge>
                    <strong className="font-mono text-sm">{row.template.时间}</strong>
                    <strong className="font-mono text-sm">¥ {Number(row.template.金额 || 0).toFixed(2)}</strong>
                    <span className="text-sm text-muted-foreground">{row.template.账户1}</span>
                  </span>
                  <span className="block truncate font-medium">
                    {row.transaction.counterparty || row.transaction.item || row.template.备注 || "未命名交易"}
                  </span>
                  <small className="mt-1 block truncate text-muted-foreground">{row.template.备注}</small>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onResolve(new Set())}>
            都不重复
          </Button>
          <Button type="button" onClick={() => onResolve(selection)}>
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
