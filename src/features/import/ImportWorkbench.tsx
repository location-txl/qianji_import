"use client";

import { useMemo, useState } from "react";
import { ConfigPanel } from "./ConfigPanel";
import { createQianjiCsv, updateTemplateFields } from "./export";
import { PreviewTable } from "./PreviewTable";
import { buildPreviewRows } from "./transform";
import type { QianjiHeader, QianjiTemplateRow, RowOverride } from "./types";
import { useConfigManager } from "./useConfigManager";
import { useFileImport } from "./useFileImport";
import { useAiCategorize } from "./useAiCategorize";
import { useDuplicateResolution } from "./useDuplicateResolution";
import { isDuplicateRow, EMPTY_BATCH, type BatchEdit, type ViewFilter } from "./utils";
import { FileUploadSection } from "./FileUploadSection";
import { StatsBar } from "./StatsBar";
import { FilterToolbar } from "./FilterToolbar";
import { BatchEditBar } from "./BatchEditBar";
import { AiToolbar } from "./AiToolbar";
import { DuplicateConfirmDialog } from "./DuplicateConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Download, Settings2 } from "lucide-react";

export function ImportWorkbench() {
  // ── config ──
  const { config, dirty, saving, message: configMessage, updateConfig, saveConfig } = useConfigManager();

  // ── shared state owned by workbench ──
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [search, setSearch] = useState("");
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [batch, setBatch] = useState<BatchEdit>(EMPTY_BATCH);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── file import ──
  const {
    transactions,
    existingRecords,
    loadedFiles,
    loadedExistingFile,
    importMessage,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    loadFile,
    loadExistingQianjiFile,
  } = useFileImport(setOverrides, setSelectedIds);

  // ── derived rows ──
  const rows = useMemo(
    () => buildPreviewRows(transactions, config, overrides, {
      from: dateFrom || undefined,
      to: dateTo || undefined,
      existingRecords,
    }),
    [transactions, config, overrides, dateFrom, dateTo, existingRecords],
  );
  const readyRows = rows.filter((row) => row.canExport);
  const uncategorizedReadyRows = readyRows.filter((row) => row.template.分类 === "");
  const duplicateRows = rows.filter(isDuplicateRow);
  const pendingRows = rows.filter((row) => !row.canExport && !isDuplicateRow(row));
  const aiTargetRows = uncategorizedReadyRows;
  const visibleRows = rows.filter((row) => {
    if (filter === "ready" && !row.canExport) return false;
    if (filter === "ready" && uncategorizedOnly && row.template.分类 !== "") return false;
    if (filter === "pending" && (row.canExport || isDuplicateRow(row))) return false;
    if (filter === "duplicate" && !isDuplicateRow(row)) return false;
    const keyword = search.trim();
    return (
      !keyword ||
      [
        row.transaction.counterparty,
        row.transaction.item,
        row.transaction.paymentMethod,
        row.template.账户1,
        row.template.备注,
        row.template.分类,
      ].some((value) => value.includes(keyword))
    );
  });
  const totalAmount = readyRows.reduce((sum, row) => sum + Number(row.template.金额 || 0), 0);

  // ── duplicate resolution ──
  const {
    duplicateConfirmGroups,
    activeDuplicateGroup,
    duplicateDialogOpen,
    duplicateSelection,
    activeDuplicateGroupId,
    setClosedDuplicateGroupId,
    resetAutoOpen,
    selectDuplicateCandidate,
    resolveDuplicateGroup,
  } = useDuplicateResolution(rows, setOverrides, setSelectedIds);

  // ── AI categorize ──
  const {
    aiSuggestions,
    aiLoading,
    aiError,
    aiSuggestionCount,
    adoptAiSuggestion,
    dismissAiSuggestion,
    adoptAllAiSuggestions,
    runAiCategorize,
  } = useAiCategorize(config, transactions, aiTargetRows, setOverrides, updateConfig);

  // ── row editing helpers ──
  function setRowField(id: string, field: QianjiHeader, value: string) {
    setOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        fields: updateTemplateFields(current[id]?.fields, field, value),
      },
    }));
  }

  function selectRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(visibleRows.map((row) => row.id)) : new Set());
  }

  function applyBatch() {
    const fields = Object.fromEntries(
      Object.entries(batch).filter(([, value]) => value !== ""),
    ) as Partial<QianjiTemplateRow>;
    if (Object.keys(fields).length === 0) return;
    setOverrides((current) => {
      const next = { ...current };
      selectedIds.forEach((id) => {
        next[id] = { ...next[id], fields: { ...(next[id]?.fields ?? {}), ...fields } };
      });
      return next;
    });
  }

  function setSelectedInclude(include: boolean) {
    setOverrides((current) => {
      const next = { ...current };
      selectedIds.forEach((id) => {
        next[id] = { ...next[id], include };
      });
      return next;
    });
  }

  function downloadCsv() {
    const content = createQianjiCsv(rows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = `钱迹导入模板_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── date change wrappers (clear selection on date change) ──
  function handleDateFromChange(value: string) {
    setDateFrom(value);
    setSelectedIds(new Set());
  }
  function handleDateToChange(value: string) {
    setDateTo(value);
    setSelectedIds(new Set());
  }

  // ── filter change wrapper (reset uncategorizedOnly) ──
  function handleFilterChange(next: ViewFilter) {
    setFilter(next);
    setUncategorizedOnly(false);
  }

  return (
    <main
      className="min-h-screen px-[clamp(18px,3.5vw,56px)] pb-12 pt-11 text-foreground"
      style={{
        background:
          "radial-gradient(circle at 96% 4%, rgba(182, 91, 50, 0.13), transparent 26rem), repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(22, 63, 59, 0.022) 48px), var(--background)",
      }}
    >
      <header className="mx-auto mb-8 flex max-w-[1560px] justify-between gap-8 border-b border-border pb-7">
        <div>
          <p className="mb-2.5 font-mono text-[11px] font-bold tracking-[0.18em] text-accent">LOCAL LEDGER CONVERTER</p>
          <h1 className="mb-3 font-title text-[clamp(38px,4vw,56px)] font-bold tracking-[0.08em]">钱迹账簿整理台</h1>
          <p className="max-w-[620px] text-base text-muted-foreground leading-[1.75]">
            把支付宝与微信账单对齐到钱迹模板。账单留在当前页面，规则仅保存在你的电脑。
          </p>
        </div>
        <div className="self-end min-w-[244px] rounded-sm bg-primary p-[18px_22px] text-primary-foreground">
          <span className="mb-2 block font-mono text-[11px] tracking-[0.16em] text-[#b6d1c8]">模板边界</span>
          <strong className="block font-title text-xl tracking-[0.08em]">退款、转账、红包</strong>
          <small className="mt-1.5 block text-[#d9ded8]">默认暂停导出，等待人工确认</small>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1560px] flex-col gap-5">
        <FileUploadSection
          loadedExistingFile={loadedExistingFile}
          loadedFiles={loadedFiles}
          importMessage={importMessage}
          hasTransactions={transactions.length > 0}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={handleDateFromChange}
          onDateToChange={handleDateToChange}
          onLoadFile={(source, event) => { loadFile(source, event); resetAutoOpen(); }}
          onLoadExisting={(event) => { loadExistingQianjiFile(event); resetAutoOpen(); }}
        />

        <Card className="min-h-[720px]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-accent">03 / 校对并导出</p>
                <CardTitle className="text-2xl">钱迹模板预览</CardTitle>
              </div>
              <Button size="lg" type="button" onClick={downloadCsv} disabled={readyRows.length === 0} className="h-[43px] px-6 font-bold">
                <Download data-icon="inline-start" />
                导出 CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            <StatsBar
              totalCount={rows.length}
              readyCount={readyRows.length}
              pendingCount={pendingRows.length}
              duplicateCount={duplicateRows.length}
              totalAmount={totalAmount}
            />

            <FilterToolbar
              filter={filter}
              search={search}
              uncategorizedOnly={uncategorizedOnly}
              totalCount={rows.length}
              readyCount={readyRows.length}
              pendingCount={pendingRows.length}
              duplicateCount={duplicateRows.length}
              uncategorizedReadyCount={uncategorizedReadyRows.length}
              onFilterChange={handleFilterChange}
              onSearchChange={setSearch}
              onUncategorizedOnlyChange={setUncategorizedOnly}
            />

            <BatchEditBar
              batch={batch}
              selectedCount={selectedIds.size}
              onBatchChange={setBatch}
              onApply={applyBatch}
              onInclude={() => setSelectedInclude(true)}
              onExclude={() => setSelectedInclude(false)}
              onClearSelection={() => setSelectedIds(new Set())}
            />

            <AiToolbar
              visible={transactions.length > 0}
              loading={aiLoading}
              error={aiError}
              suggestionCount={aiSuggestionCount}
              targetCount={aiTargetRows.length}
              onRun={runAiCategorize}
              onAdoptAll={adoptAllAiSuggestions}
            />

            {duplicateConfirmGroups.length > 0 && (
              <Alert className="mb-3 border-warning bg-warning text-warning-foreground">
                <AlertTitle>{duplicateConfirmGroups.length} 组疑似重复需要确认。</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>同一时间、金额、账户下出现多条候选，先确认实际重复项再导出。</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setClosedDuplicateGroupId("")}>
                    确认重复
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {pendingRows.length > 0 && (
              <Alert className="mb-3 border-warning bg-warning text-warning-foreground">
                <AlertTitle>{pendingRows.length} 条记录未进入默认导出。</AlertTitle>
                <AlertDescription>
                  在{'"'}待处理{'"'}中核对问题；确定合法类型与账户后，选中并点击{'"'}纳入导出{'"'}。
                </AlertDescription>
              </Alert>
            )}
            <PreviewTable
              rows={visibleRows}
              selectedIds={selectedIds}
              onSelect={selectRow}
              onSelectAll={selectAll}
              onFieldChange={setRowField}
              masterCategories={config.masterCategories}
              aiSuggestions={aiSuggestions}
              onAdoptAiSuggestion={adoptAiSuggestion}
              onDismissAiSuggestion={dismissAiSuggestion}
            />
          </CardContent>
        </Card>
      </div>

      {/* 全局 datalist：供 BatchEditBar 和其他不在 ConfigPanel 中的输入使用 */}
      <datalist id="master-category-options">
        {config.masterCategories.map((mc) => <option key={mc.category} value={mc.category} />)}
      </datalist>
      <datalist id="master-subcategory-options">
        {config.masterCategories.flatMap((mc) => mc.subCategories).filter((v, i, a) => a.indexOf(v) === i).sort((l, r) => l.localeCompare(r, "zh-CN")).map((sub) => <option key={sub} value={sub} />)}
      </datalist>

      {/* 浮动映射规则按钮 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <button
              type="button"
              className="fixed bottom-6 right-6 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 cursor-pointer"
            >
              <Settings2 className="size-4" />
              映射规则
            </button>
          }
        />
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <ConfigPanel
            config={config}
            transactions={transactions}
            dirty={dirty}
            saving={saving}
            message={configMessage}
            onChange={updateConfig}
            onSave={saveConfig}
          />
        </DialogContent>
      </Dialog>

      <DuplicateConfirmDialog
        open={duplicateDialogOpen}
        group={activeDuplicateGroup}
        selection={duplicateSelection}
        onOpenChange={(open) => {
          if (open) {
            setClosedDuplicateGroupId("");
          } else if (duplicateDialogOpen) {
            setClosedDuplicateGroupId(activeDuplicateGroupId);
          }
        }}
        onSelectCandidate={selectDuplicateCandidate}
        onResolve={resolveDuplicateGroup}
      />
    </main>
  );
}
