"use client";

import { QIANJI_HEADERS, type PreviewRow, type QianjiHeader } from "./types";
import styles from "./import-workbench.module.css";

/**
 * 最终模板预览表属性，所有编辑动作交由工作台维护覆盖状态。
 */
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
      <select value={row.template[header]} onChange={(event) => onChange(row.id, header, event.target.value)}>
        {TYPES.map((type) => <option key={type || "empty"} value={type}>{type || "待定"}</option>)}
      </select>
    );
  }

  return (
    <input
      list={header === "账户1" || header === "账户2" ? "account-options" : undefined}
      value={row.template[header]}
      onChange={(event) => onChange(row.id, header, event.target.value)}
      aria-label={`${sourceName(row)} ${header}`}
    />
  );
}

/**
 * 展示钱迹全字段表格并支持逐行修改，不隐藏任何会进入 CSV 的列。
 */
export function PreviewTable({
  rows,
  selectedIds,
  onSelect,
  onSelectAll,
  onFieldChange,
}: PreviewTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  return (
    <div className={styles.tableFrame}>
      <table className={styles.previewTable}>
        <thead>
          <tr>
            <th className={styles.selectCell}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onSelectAll(event.target.checked)}
                aria-label="选中当前列表全部记录"
              />
            </th>
            <th>来源 / 状态</th>
            {QIANJI_HEADERS.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.canExport ? styles.readyRow : styles.pendingRow} key={row.id}>
              <td className={styles.selectCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onChange={(event) => onSelect(row.id, event.target.checked)}
                  aria-label={`选中 ${sourceName(row)} 第 ${row.transaction.sourceRow} 行`}
                />
              </td>
              <td className={styles.sourceCell}>
                <strong>{sourceName(row)}</strong>
                <span>{row.transaction.transactionKind}</span>
                <small>{row.canExport ? "可导出" : row.issues[0]?.message ?? "待处理"}</small>
              </td>
              {QIANJI_HEADERS.map((header) => (
                <td key={header} className={header === "备注" ? styles.noteCell : undefined}>
                  <TemplateInput row={row} header={header} onChange={onFieldChange} />
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className={styles.noRows} colSpan={QIANJI_HEADERS.length + 2}>
                当前筛选条件下没有账单记录。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
