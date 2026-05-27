"use client";

import { QIANJI_HEADERS, type PreviewRow, type QianjiHeader } from "./types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface PreviewTableProps {
  rows: PreviewRow[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onFieldChange: (id: string, field: QianjiHeader, value: string) => void;
}

const TYPES = ["", "收入", "支出", "报销", "转账", "还款"];

function sourceName(row: PreviewRow): string {
  return row.source === "alipay" ? "支付宝" : "微信";
}

function TemplateInput({
  row,
  header,
  onChange,
}: {
  row: PreviewRow;
  header: QianjiHeader;
  onChange: (id: string, field: QianjiHeader, value: string) => void;
}) {
  if (header === "类型") {
    return (
      <select
        value={row.template[header]}
        onChange={(event) => onChange(row.id, header, event.target.value)}
        className="h-8 min-w-[105px] rounded-sm border border-input bg-white/75 px-2 text-xs"
      >
        {TYPES.map((type) => <option key={type || "empty"} value={type}>{type || "待定"}</option>)}
      </select>
    );
  }

  return (
    <Input
      list={header === "账户1" || header === "账户2" ? "account-options" : undefined}
      value={row.template[header]}
      onChange={(event) => onChange(row.id, header, event.target.value)}
      aria-label={`${sourceName(row)} ${header}`}
      className={cn(
        "h-8 min-w-[105px] bg-white/75 text-xs",
        header === "备注" && "min-w-[270px]",
      )}
    />
  );
}

export function PreviewTable({
  rows,
  selectedIds,
  onSelect,
  onSelectAll,
  onFieldChange,
}: PreviewTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  return (
    <div className="overflow-auto max-h-[calc(100vh-360px)] min-h-[330px] rounded-sm border border-border">
      <table className="w-full min-w-[2180px] border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-[4] w-[42px] min-w-[42px] bg-primary p-[11px_8px] text-center text-primary-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAll(checked === true)}
                aria-label="选中当前列表全部记录"
              />
            </th>
            <th className="sticky top-0 left-[42px] z-[3] bg-primary p-[11px_8px] text-left font-semibold text-primary-foreground whitespace-nowrap">
              来源 / 状态
            </th>
            {QIANJI_HEADERS.map((header) => (
              <th key={header} className="sticky top-0 z-[2] bg-primary p-[11px_8px] text-left font-semibold text-primary-foreground whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                row.canExport ? "[&_td]:bg-card" : "[&_td]:bg-[#fff9f0]",
              )}
            >
              <td className="sticky left-0 z-[1] w-[42px] min-w-[42px] border-b border-[#ede6db] p-1.5 text-center">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={(checked) => onSelect(row.id, checked === true)}
                  aria-label={`选中 ${sourceName(row)} 第 ${row.transaction.sourceRow} 行`}
                />
              </td>
              <td className="sticky left-[42px] z-[1] min-w-[205px] border-b border-[#ede6db] p-1.5 align-top">
                <strong className="block text-primary">{sourceName(row)}</strong>
                <span className="mb-1 block">{row.transaction.transactionKind}</span>
                <small className={cn(
                  "block max-w-[188px] leading-[1.42]",
                  row.canExport ? "text-[#44816f]" : "text-warning-foreground",
                )}>
                  {row.canExport ? "可导出" : row.issues[0]?.message ?? "待处理"}
                </small>
              </td>
              {QIANJI_HEADERS.map((header) => (
                <td key={header} className="border-b border-[#ede6db] p-1.5 align-top">
                  <TemplateInput row={row} header={header} onChange={onFieldChange} />
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-11 text-center text-muted-foreground" colSpan={QIANJI_HEADERS.length + 2}>
                当前筛选条件下没有账单记录。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
