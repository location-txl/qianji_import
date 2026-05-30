"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { DEFAULT_CONFIG, parseAppConfig } from "./config";
import { ConfigPanel } from "./ConfigPanel";
import { createQianjiCsv, updateTemplateFields } from "./export";
import { parseAlipayBuffer, parseQianjiExistingCsvBuffer, parseWechatBuffer } from "./parsers";
import { PreviewTable } from "./PreviewTable";
import { buildPreviewRows } from "./transform";
import type {
  AppConfig,
  ExistingQianjiRecord,
  NormalizedTransaction,
  PreviewRow,
  QianjiHeader,
  QianjiTemplateRow,
  RowOverride,
  SourcePlatform,
} from "./types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download, Settings2 } from "lucide-react";

type ViewFilter = "all" | "ready" | "pending" | "duplicate";

interface LoadedFile {
  name: string;
  count: number;
}

interface BatchEdit {
  分类: string;
  类型: string;
  账户1: string;
  备注: string;
}

interface DuplicateConfirmGroup {
  key: string;
  existingCount: number;
  rows: PreviewRow[];
}

const EMPTY_BATCH: BatchEdit = { 分类: "", 类型: "", 账户1: "", 备注: "" };

function isDuplicateRow(row: { issues: { code: string }[] }): boolean {
  return row.issues.some((issue) => issue.code === "duplicate_existing" || issue.code === "duplicate_pending");
}

function isDuplicatePendingRow(row: PreviewRow): boolean {
  return row.issues.some((issue) => issue.code === "duplicate_pending");
}

function sourceLabel(source: SourcePlatform): string {
  return source === "alipay" ? "支付宝" : "微信";
}

function buildDuplicateConfirmGroups(rows: PreviewRow[]): DuplicateConfirmGroup[] {
  const groups = new Map<string, PreviewRow[]>();
  rows.forEach((row) => {
    if (!row.duplicateKey || !isDuplicatePendingRow(row)) {
      return;
    }
    groups.set(row.duplicateKey, [...(groups.get(row.duplicateKey) ?? []), row]);
  });
  return Array.from(groups, ([key, groupedRows]) => ({
    key,
    rows: groupedRows,
    existingCount: groupedRows[0].duplicateExistingCount ?? 1,
  }));
}

function withoutDuplicateDecision(override: RowOverride): RowOverride | null {
  const rest: RowOverride = { ...override };
  delete rest.duplicateExisting;
  delete rest.duplicateKey;
  const hasFields = Boolean(rest.fields && Object.keys(rest.fields).length > 0);
  return hasFields || rest.include !== undefined ? rest : null;
}

export function ImportWorkbench() {
  const [config, setConfig] = useState<AppConfig>(structuredClone(DEFAULT_CONFIG));
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [existingRecords, setExistingRecords] = useState<ExistingQianjiRecord[]>([]);
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [loadedFiles, setLoadedFiles] = useState<Partial<Record<SourcePlatform, LoadedFile>>>({});
  const [loadedExistingFile, setLoadedExistingFile] = useState<LoadedFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [search, setSearch] = useState("");
  const [closedDuplicateGroupId, setClosedDuplicateGroupId] = useState("");
  const [autoOpenedDuplicateGroupId, setAutoOpenedDuplicateGroupId] = useState("");
  const [duplicateSelectionState, setDuplicateSelectionState] = useState<{ groupId: string; ids: Set<string> }>({
    groupId: "",
    ids: new Set(),
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [batch, setBatch] = useState<BatchEdit>(EMPTY_BATCH);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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
          setConfig(savedConfig);
        }
      })
      .catch((error: Error) => {
        if (active) {
          setConfigMessage(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () => buildPreviewRows(transactions, config, overrides, {
      from: dateFrom || undefined,
      to: dateTo || undefined,
      existingRecords,
    }),
    [transactions, config, overrides, dateFrom, dateTo, existingRecords],
  );
  const readyRows = rows.filter((row) => row.canExport);
  const duplicateRows = rows.filter(isDuplicateRow);
  const pendingRows = rows.filter((row) => !row.canExport && !isDuplicateRow(row));
  const duplicateConfirmGroups = useMemo(() => buildDuplicateConfirmGroups(rows), [rows]);
  const activeDuplicateGroup = duplicateConfirmGroups[0] ?? null;
  const hasActiveDuplicateGroup = Boolean(activeDuplicateGroup);
  const activeDuplicateGroupId = activeDuplicateGroup
    ? `${activeDuplicateGroup.key}:${activeDuplicateGroup.rows.map((row) => row.id).join(",")}:${activeDuplicateGroup.existingCount}`
    : "";
  const duplicateDialogOpen = hasActiveDuplicateGroup && closedDuplicateGroupId !== activeDuplicateGroupId;
  const duplicateSelection = duplicateSelectionState.groupId === activeDuplicateGroupId
    ? duplicateSelectionState.ids
    : new Set<string>();
  const visibleRows = rows.filter((row) => {
    if (filter === "ready" && !row.canExport) {
      return false;
    }
    if (filter === "pending" && (row.canExport || isDuplicateRow(row))) {
      return false;
    }
    if (filter === "duplicate" && !isDuplicateRow(row)) {
      return false;
    }
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

  useEffect(() => {
    if (!activeDuplicateGroupId || autoOpenedDuplicateGroupId === activeDuplicateGroupId) {
      return;
    }
    const timer = window.setTimeout(() => {
      setClosedDuplicateGroupId("");
      setAutoOpenedDuplicateGroupId(activeDuplicateGroupId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeDuplicateGroupId, autoOpenedDuplicateGroupId]);

  function updateConfig(next: AppConfig) {
    setConfig(next);
    setDirty(true);
    setConfigMessage("");
  }

  async function saveConfig() {
    setSaving(true);
    setConfigMessage("");
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
      setConfigMessage("配置已写入本机。");
    } catch (error) {
      setConfigMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function loadFile(source: SourcePlatform, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportMessage("");
    try {
      const parsed =
        source === "alipay"
          ? parseAlipayBuffer(await file.arrayBuffer())
          : parseWechatBuffer(await file.arrayBuffer());
      setTransactions((current) => [...current.filter((row) => row.source !== source), ...parsed]);
      setOverrides((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith(`${source}-`))),
      );
      setAutoOpenedDuplicateGroupId("");
      setSelectedIds(new Set());
      setLoadedFiles((current) => ({ ...current, [source]: { name: file.name, count: parsed.length } }));
      setImportMessage(`${source === "alipay" ? "支付宝" : "微信"}账单已解析，共 ${parsed.length} 条记录。`);
    } catch (error) {
      setImportMessage((error as Error).message);
    } finally {
      event.target.value = "";
    }
  }

  async function loadExistingQianjiFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportMessage("");
    try {
      const parsed = parseQianjiExistingCsvBuffer(await file.arrayBuffer());
      setExistingRecords(parsed);
      setOverrides((current) =>
        Object.fromEntries(
          Object.entries(current).flatMap(([id, override]) => {
            const next = withoutDuplicateDecision(override);
            return next ? [[id, next]] : [];
          }),
        ),
      );
      setAutoOpenedDuplicateGroupId("");
      setSelectedIds(new Set());
      setLoadedExistingFile({ name: file.name, count: parsed.length });
      setImportMessage(`钱迹已有账单已载入，共 ${parsed.length} 条可参与去重。`);
    } catch (error) {
      setImportMessage((error as Error).message);
    } finally {
      event.target.value = "";
    }
  }

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
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
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
    if (Object.keys(fields).length === 0) {
      return;
    }
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

  function selectDuplicateCandidate(id: string, checked: boolean) {
    setDuplicateSelectionState((current) => {
      const currentIds = current.groupId === activeDuplicateGroupId ? current.ids : new Set<string>();
      const next = new Set(currentIds);
      if (checked) {
        if (activeDuplicateGroup && next.size >= activeDuplicateGroup.existingCount) {
          return current;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return { groupId: activeDuplicateGroupId, ids: next };
    });
  }

  function resolveDuplicateGroup(duplicateIds: Set<string>) {
    if (!activeDuplicateGroup) {
      return;
    }
    const ids = activeDuplicateGroup.rows.map((row) => row.id);
    setOverrides((current) => {
      const next = { ...current };
      ids.forEach((id) => {
        next[id] = {
          ...next[id],
          duplicateExisting: duplicateIds.has(id),
          duplicateKey: activeDuplicateGroup.key,
        };
      });
      return next;
    });
    setSelectedIds(new Set());
    setClosedDuplicateGroupId(activeDuplicateGroupId);
  }

  function downloadCsv() {
    const content = createQianjiCsv(rows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = `钱迹导入模板_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
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
        {/* 导入文件 */}
        <Card>
          <CardHeader>
            <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-accent">01 / 导入文件</p>
            <CardTitle>来源账单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <label className="block cursor-pointer rounded-sm border border-dashed border-[#c5b9a7] bg-[#fcf8f0] p-4 transition-colors hover:border-accent hover:bg-[#fff8ee]">
                <span className="block text-xs font-bold text-accent">钱迹已有 CSV</span>
                <strong className="my-1.5 block truncate">{loadedExistingFile?.name ?? "选择已导出账单"}</strong>
                <small className="block text-muted-foreground leading-relaxed">
                  {loadedExistingFile ? `${loadedExistingFile.count} 条参与去重` : "按时间、金额、账户匹配已有记录"}
                </small>
                <input name="existing-qianji-csv" type="file" accept=".csv,text/csv" aria-label="选择钱迹已有 CSV" onChange={loadExistingQianjiFile} className="mt-3 block max-w-full text-xs text-muted-foreground" />
              </label>
              <label className="block cursor-pointer rounded-sm border border-dashed border-[#c5b9a7] bg-[#fcf8f0] p-4 transition-colors hover:border-accent hover:bg-[#fff8ee]">
                <span className="block text-xs font-bold text-accent">支付宝 CSV</span>
                <strong className="my-1.5 block truncate">{loadedFiles.alipay?.name ?? "选择交易明细"}</strong>
                <small className="block text-muted-foreground leading-relaxed">
                  {loadedFiles.alipay ? `${loadedFiles.alipay.count} 条已载入` : "支持含说明行的官方导出文件"}
                </small>
                <input name="alipay-csv" type="file" accept=".csv,text/csv" aria-label="选择支付宝 CSV" onChange={(event) => loadFile("alipay", event)} className="mt-3 block max-w-full text-xs text-muted-foreground" />
              </label>
              <label className="block cursor-pointer rounded-sm border border-dashed border-[#c5b9a7] bg-[#fcf8f0] p-4 transition-colors hover:border-accent hover:bg-[#fff8ee]">
                <span className="block text-xs font-bold text-accent">微信 XLSX</span>
                <strong className="my-1.5 block truncate">{loadedFiles.wechat?.name ?? "选择支付账单"}</strong>
                <small className="block text-muted-foreground leading-relaxed">
                  {loadedFiles.wechat ? `${loadedFiles.wechat.count} 条已载入` : "支持官方 Excel 流水文件"}
                </small>
                <input name="wechat-xlsx" type="file" accept=".xlsx" aria-label="选择微信 XLSX" onChange={(event) => loadFile("wechat", event)} className="mt-3 block max-w-full text-xs text-muted-foreground" />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-4">
              {transactions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-sm">日期范围</label>
                  <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setSelectedIds(new Set()); }} title="起始日期" className="w-[140px]" />
                  <span>—</span>
                  <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setSelectedIds(new Set()); }} title="截止日期" className="w-[140px]" />
                </div>
              )}
              {importMessage && (
                <div className="rounded-sm bg-primary/5 p-2.5 text-sm text-primary">{importMessage}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 核对并导出 */}
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
            <div className="mb-5 grid grid-cols-5 gap-2.5">
              {[
                { label: "载入记录", value: rows.length },
                { label: "可导出", value: readyRows.length },
                { label: "待处理", value: pendingRows.length, warn: pendingRows.length > 0 },
                { label: "重复", value: duplicateRows.length, warn: duplicateRows.length > 0 },
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

            <div className="mb-3 flex justify-between gap-4">
              <ToggleGroup
                value={[filter]}
                onValueChange={(value) => { if (value.length > 0) setFilter(value[0] as ViewFilter); }}
                variant="default"
                spacing={0}
                className="rounded-sm bg-[#f3ede3] p-[3px]"
              >
                <ToggleGroupItem value="all" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
                  全部 {rows.length}
                </ToggleGroupItem>
                <ToggleGroupItem value="ready" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
                  可导出 {readyRows.length}
                </ToggleGroupItem>
                <ToggleGroupItem value="pending" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
                  待处理 {pendingRows.length}
                </ToggleGroupItem>
                <ToggleGroupItem value="duplicate" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
                  重复 {duplicateRows.length}
                </ToggleGroupItem>
              </ToggleGroup>
              <InputGroup className="max-w-[270px]">
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索商户、商品或账户"
                />
                <InputGroupAddon align="inline-end">
                  <Search data-icon="inline-start" />
                </InputGroupAddon>
              </InputGroup>
            </div>

            <div className="mb-3 grid grid-cols-[auto_repeat(4,minmax(105px,1fr))_auto_auto_auto_auto] items-center gap-[7px] rounded-sm border border-[#e7dece] bg-[#f8f3eb] p-[11px_12px]">
              <strong className="mr-1.5 whitespace-nowrap text-[13px]">
                批量处理 {selectedIds.size ? `(${selectedIds.size})` : ""}
              </strong>
              <Input value={batch.分类} onChange={(event) => setBatch({ ...batch, 分类: event.target.value })} placeholder="分类" />
              <select name="batch-type" aria-label="批量设置类型" value={batch.类型} onChange={(event) => setBatch({ ...batch, 类型: event.target.value })} className="h-[34px] rounded-sm border border-input bg-white px-2 text-sm">
                <option value="">类型不改</option>
                <option value="收入">收入</option>
                <option value="支出">支出</option>
                <option value="报销">报销</option>
                <option value="转账">转账</option>
                <option value="还款">还款</option>
              </select>
              <Input list="account-options" value={batch.账户1} onChange={(event) => setBatch({ ...batch, 账户1: event.target.value })} placeholder="账户1" />
              <Input value={batch.备注} onChange={(event) => setBatch({ ...batch, 备注: event.target.value })} placeholder="备注" />
              <Button variant="outline" type="button" disabled={!selectedIds.size} onClick={applyBatch}>应用字段</Button>
              <Button variant="outline" type="button" disabled={!selectedIds.size} onClick={() => setSelectedInclude(true)}>纳入导出</Button>
              <Button variant="ghost" size="sm" type="button" disabled={!selectedIds.size} onClick={() => setSelectedInclude(false)} className="text-accent">排除</Button>
              <Button variant="ghost" size="sm" type="button" disabled={!selectedIds.size} onClick={() => setSelectedIds(new Set())} className="text-accent">清除选中</Button>
            </div>

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
            />
          </CardContent>
        </Card>
      </div>

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

      <Dialog
        open={duplicateDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setClosedDuplicateGroupId("");
          } else if (duplicateDialogOpen) {
            setClosedDuplicateGroupId(activeDuplicateGroupId);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>确认疑似重复账单</DialogTitle>
            <DialogDescription>
              钱迹已有 {activeDuplicateGroup?.existingCount ?? 0} 条同时间、金额、账户记录；本次匹配到 {activeDuplicateGroup?.rows.length ?? 0} 条候选。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 overflow-auto pr-1">
            {activeDuplicateGroup?.rows.map((row) => {
              const checked = duplicateSelection.has(row.id);
              const limitReached = duplicateSelection.size >= activeDuplicateGroup.existingCount;
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
                    onCheckedChange={(value) => selectDuplicateCandidate(row.id, value === true)}
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
            <Button type="button" variant="ghost" onClick={() => resolveDuplicateGroup(new Set())}>
              都不重复
            </Button>
            <Button type="button" onClick={() => resolveDuplicateGroup(duplicateSelection)}>
              确认选择
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
