"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { DEFAULT_CONFIG, parseAppConfig } from "./config";
import { ConfigPanel } from "./ConfigPanel";
import { createQianjiCsv, updateTemplateFields } from "./export";
import { parseAlipayBuffer, parseWechatBuffer } from "./parsers";
import { PreviewTable } from "./PreviewTable";
import { buildPreviewRows } from "./transform";
import type {
  AppConfig,
  NormalizedTransaction,
  QianjiHeader,
  QianjiTemplateRow,
  RowOverride,
  SourcePlatform,
} from "./types";
import styles from "./import-workbench.module.css";

type ViewFilter = "all" | "ready" | "pending";

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

const EMPTY_BATCH: BatchEdit = { 分类: "", 类型: "", 账户1: "", 备注: "" };

/**
 * 钱迹账单转换主工作台：账单始终留在页面内存，只有映射配置通过接口落盘。
 */
export function ImportWorkbench() {
  const [config, setConfig] = useState<AppConfig>(structuredClone(DEFAULT_CONFIG));
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [loadedFiles, setLoadedFiles] = useState<Partial<Record<SourcePlatform, LoadedFile>>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState<BatchEdit>(EMPTY_BATCH);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");

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

  const rows = useMemo(() => buildPreviewRows(transactions, config, overrides), [transactions, config, overrides]);
  const readyRows = rows.filter((row) => row.canExport);
  const pendingRows = rows.filter((row) => !row.canExport);
  const visibleRows = rows.filter((row) => {
    if (filter === "ready" && !row.canExport) {
      return false;
    }
    if (filter === "pending" && row.canExport) {
      return false;
    }
    const keyword = search.trim();
    return (
      !keyword ||
      [
        row.transaction.counterparty,
        row.transaction.item,
        row.transaction.paymentMethod,
        row.template.备注,
        row.template.分类,
      ].some((value) => value.includes(keyword))
    );
  });
  const totalAmount = readyRows.reduce((sum, row) => sum + Number(row.template.金额 || 0), 0);

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
      setSelectedIds(new Set());
      setLoadedFiles((current) => ({ ...current, [source]: { name: file.name, count: parsed.length } }));
      setImportMessage(`${source === "alipay" ? "支付宝" : "微信"}账单已解析，共 ${parsed.length} 条记录。`);
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

  function downloadCsv() {
    const content = createQianjiCsv(rows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = `钱迹导入模板_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className={styles.workbench}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>LOCAL LEDGER CONVERTER</p>
          <h1>钱迹账簿整理台</h1>
          <p className={styles.lead}>把支付宝与微信账单对齐到钱迹模板。账单留在当前页面，规则仅保存在你的电脑。</p>
        </div>
        <div className={styles.heroNote}>
          <span>模板边界</span>
          <strong>退款、转账、红包</strong>
          <small>默认暂停导出，等待人工确认</small>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>01 / 导入文件</p>
                <h2>来源账单</h2>
              </div>
            </div>
            <label className={styles.uploadCard}>
              <span>支付宝 CSV</span>
              <strong>{loadedFiles.alipay?.name ?? "选择交易明细"}</strong>
              <small>{loadedFiles.alipay ? `${loadedFiles.alipay.count} 条已载入` : "支持含说明行的官方导出文件"}</small>
              <input type="file" accept=".csv,text/csv" onChange={(event) => loadFile("alipay", event)} />
            </label>
            <label className={styles.uploadCard}>
              <span>微信 XLSX</span>
              <strong>{loadedFiles.wechat?.name ?? "选择支付账单"}</strong>
              <small>{loadedFiles.wechat ? `${loadedFiles.wechat.count} 条已载入` : "支持官方 Excel 流水文件"}</small>
              <input type="file" accept=".xlsx" onChange={(event) => loadFile("wechat", event)} />
            </label>
            {importMessage && <p className={styles.message}>{importMessage}</p>}
          </section>
          <ConfigPanel
            config={config}
            transactions={transactions}
            dirty={dirty}
            saving={saving}
            message={configMessage}
            onChange={updateConfig}
            onSave={saveConfig}
          />
        </aside>

        <section className={`${styles.panel} ${styles.results}`}>
          <div className={styles.resultsHead}>
            <div>
              <p className={styles.eyebrow}>03 / 校对并导出</p>
              <h2>钱迹模板预览</h2>
            </div>
            <button className={styles.exportButton} type="button" onClick={downloadCsv} disabled={readyRows.length === 0}>
              导出 CSV
            </button>
          </div>

          <div className={styles.metrics}>
            <article><span>载入记录</span><strong>{rows.length}</strong></article>
            <article><span>可导出</span><strong>{readyRows.length}</strong></article>
            <article className={pendingRows.length ? styles.warningMetric : undefined}><span>待处理</span><strong>{pendingRows.length}</strong></article>
            <article><span>导出金额合计</span><strong>¥ {totalAmount.toFixed(2)}</strong></article>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.filterTabs}>
              {([
                ["all", `全部 ${rows.length}`],
                ["ready", `可导出 ${readyRows.length}`],
                ["pending", `待处理 ${pendingRows.length}`],
              ] as [ViewFilter, string][]).map(([value, label]) => (
                <button
                  className={filter === value ? styles.activeTab : undefined}
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className={styles.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索商户、商品或账户"
            />
          </div>

          <div className={styles.batchBar}>
            <strong>批量处理 {selectedIds.size ? `(${selectedIds.size})` : ""}</strong>
            <input value={batch.分类} onChange={(event) => setBatch({ ...batch, 分类: event.target.value })} placeholder="分类" />
            <select value={batch.类型} onChange={(event) => setBatch({ ...batch, 类型: event.target.value })}>
              <option value="">类型不改</option>
              <option value="收入">收入</option>
              <option value="支出">支出</option>
              <option value="报销">报销</option>
              <option value="转账">转账</option>
              <option value="还款">还款</option>
            </select>
            <input list="account-options" value={batch.账户1} onChange={(event) => setBatch({ ...batch, 账户1: event.target.value })} placeholder="账户1" />
            <input value={batch.备注} onChange={(event) => setBatch({ ...batch, 备注: event.target.value })} placeholder="备注" />
            <button type="button" className={styles.secondaryButton} disabled={!selectedIds.size} onClick={applyBatch}>应用字段</button>
            <button type="button" className={styles.secondaryButton} disabled={!selectedIds.size} onClick={() => setSelectedInclude(true)}>纳入导出</button>
            <button type="button" className={styles.textButton} disabled={!selectedIds.size} onClick={() => setSelectedInclude(false)}>排除</button>
          </div>

          {pendingRows.length > 0 && (
            <div className={styles.notice}>
              <strong>{pendingRows.length} 条记录未进入默认导出。</strong>
              <span>在“待处理”中核对问题；确定合法类型与账户后，选中并点击“纳入导出”。</span>
            </div>
          )}
          <PreviewTable
            rows={visibleRows}
            selectedIds={selectedIds}
            onSelect={selectRow}
            onSelectAll={selectAll}
            onFieldChange={setRowField}
          />
        </section>
      </div>
    </main>
  );
}
