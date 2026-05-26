import { QIANJI_HEADERS, type PreviewRow, type QianjiTemplateRow } from "./types";

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * 将当前确认可导出的预览行编码成钱迹可导入的 UTF-8 BOM CSV。
 *
 * @param rows 预览区内包含人工修改结果的全部行。
 * @returns 只包含可导出记录的钱迹模板 CSV 内容。
 */
export function createQianjiCsv(rows: PreviewRow[]): string {
  const exportedRows = rows.filter((row) => row.canExport).map((row) => row.template);
  const lines = [
    QIANJI_HEADERS.join(","),
    ...exportedRows.map((row) => QIANJI_HEADERS.map((header) => escapeCsv(row[header])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function updateTemplateFields(
  current: Partial<QianjiTemplateRow> | undefined,
  field: keyof QianjiTemplateRow,
  value: string,
): Partial<QianjiTemplateRow> {
  return { ...(current ?? {}), [field]: value };
}
