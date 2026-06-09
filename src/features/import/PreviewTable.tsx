"use client";

import { QIANJI_HEADERS, type AICategorySuggestion, type MasterCategory, type PreviewRow, type QianjiHeader } from "./types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X } from "lucide-react";

interface PreviewTableProps {
  rows: PreviewRow[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onFieldChange: (id: string, field: QianjiHeader, value: string) => void;
  masterCategories?: MasterCategory[];
  aiSuggestions?: Record<string, AICategorySuggestion>;
  onAdoptAiSuggestion?: (id: string) => void;
  onDismissAiSuggestion?: (id: string) => void;
}

const TYPES = ["", "收入", "支出", "报销", "转账", "还款"];

function sourceName(row: PreviewRow): string {
  return row.source === "alipay" ? "支付宝" : "微信";
}

function AiSuggestionBadge({
  suggestion,
  onAdopt,
  onDismiss,
}: {
  suggestion: AICategorySuggestion;
  onAdopt: () => void;
  onDismiss: () => void;
}) {
  const label = suggestion.subCategory
    ? `${suggestion.category}/${suggestion.subCategory}`
    : suggestion.category;
  return (
    <div className="mt-1 flex items-center gap-1" title={suggestion.reasoning}>
      <Sparkles className="size-3 text-accent" />
      <Badge variant="secondary" className="max-w-[140px] truncate rounded-sm px-1.5 py-0 text-[10px] font-normal">
        {label}
      </Badge>
      <button
        type="button"
        onClick={onAdopt}
        title="采纳"
        className="cursor-pointer rounded-sm p-0.5 text-[#44816f] hover:bg-[#44816f]/10"
      >
        <Check className="size-3" />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        title="忽略"
        className="cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:bg-muted/40"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function TemplateInput({
  row,
  header,
  onChange,
  masterCategories,
  aiSuggestion,
  onAdoptAi,
  onDismissAi,
}: {
  row: PreviewRow;
  header: QianjiHeader;
  onChange: (id: string, field: QianjiHeader, value: string) => void;
  masterCategories?: MasterCategory[];
  aiSuggestion?: AICategorySuggestion;
  onAdoptAi?: () => void;
  onDismissAi?: () => void;
}) {
  const categoryListId = masterCategories && masterCategories.length > 0 ? `mc-cat-${row.id}` : undefined;
  const subCategoryListId = masterCategories && masterCategories.length > 0 ? `mc-sub-${row.id}` : undefined;

  // 查找当前行一级分类对应的二级分类
  const currentCategory = row.template.分类;
  const matchedCategory = masterCategories?.find((mc) => mc.category === currentCategory);
  const subCategoriesForCurrent = matchedCategory?.subCategories ?? [];

  // 分类列：显示 AI 建议 badge
  if (header === "分类" && aiSuggestion && onAdoptAi && onDismissAi) {
    return (
      <div>
        <Input
          list={categoryListId}
          value={row.template[header]}
          onChange={(event) => onChange(row.id, header, event.target.value)}
          aria-label={`${sourceName(row)} ${header}`}
          className="h-8 min-w-[105px] bg-white/75 text-xs"
        />
        <AiSuggestionBadge suggestion={aiSuggestion} onAdopt={onAdoptAi} onDismiss={onDismissAi} />
        {categoryListId && (
          <datalist id={categoryListId}>
            {masterCategories!.map((mc) => <option key={mc.category} value={mc.category} />)}
          </datalist>
        )}
      </div>
    );
  }

  if (header === "类型") {
    return (
      <select
        name={`${row.id}-${header}`}
        aria-label={`${sourceName(row)} ${header}`}
        value={row.template[header]}
        onChange={(event) => onChange(row.id, header, event.target.value)}
        className="h-8 min-w-[105px] rounded-sm border border-input bg-white/75 px-2 text-xs"
      >
        {TYPES.map((type) => <option key={type || "empty"} value={type}>{type || "待定"}</option>)}
      </select>
    );
  }

  const datalistId = header === "分类" ? categoryListId
    : header === "二级分类" ? subCategoryListId
    : header === "账户1" || header === "账户2" ? "account-options"
    : undefined;

  return (
    <>
      <Input
        list={datalistId}
        value={row.template[header]}
        onChange={(event) => onChange(row.id, header, event.target.value)}
        aria-label={`${sourceName(row)} ${header}`}
        className={cn(
          "h-8 min-w-[105px] bg-white/75 text-xs",
          header === "备注" && "min-w-[270px]",
        )}
      />
      {header === "分类" && masterCategories && masterCategories.length > 0 && (
        <datalist id={categoryListId}>
          {masterCategories.map((mc) => <option key={mc.category} value={mc.category} />)}
        </datalist>
      )}
      {header === "二级分类" && subCategoriesForCurrent.length > 0 && (
        <datalist id={subCategoryListId}>
          {subCategoriesForCurrent.map((sub) => <option key={sub} value={sub} />)}
        </datalist>
      )}
    </>
  );
}

export function PreviewTable({
  rows,
  selectedIds,
  onSelect,
  onSelectAll,
  onFieldChange,
  masterCategories,
  aiSuggestions,
  onAdoptAiSuggestion,
  onDismissAiSuggestion,
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
          {rows.map((row) => {
            const suggestion = aiSuggestions?.[row.id];
            return (
              <tr
                key={row.id}
                className={cn(
                  row.canExport ? "[&_td]:bg-card" : "[&_td]:bg-[#fff9f0]",
                  suggestion && "[&_td]:bg-[#f5f0ff]",
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
                    <TemplateInput
                      row={row}
                      header={header}
                      onChange={onFieldChange}
                      masterCategories={masterCategories}
                      aiSuggestion={header === "分类" ? suggestion : undefined}
                      onAdoptAi={header === "分类" && suggestion ? () => onAdoptAiSuggestion?.(row.id) : undefined}
                      onDismissAi={header === "分类" && suggestion ? () => onDismissAiSuggestion?.(row.id) : undefined}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
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
