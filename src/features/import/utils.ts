import type { PreviewRow, RowOverride, SourcePlatform } from "./types";

export type ViewFilter = "all" | "ready" | "pending" | "duplicate";

export interface LoadedFile {
  name: string;
  count: number;
}

export interface BatchEdit {
  分类: string;
  类型: string;
  账户1: string;
  备注: string;
}

export interface DuplicateConfirmGroup {
  key: string;
  existingCount: number;
  rows: PreviewRow[];
}

export const EMPTY_BATCH: BatchEdit = { 分类: "", 类型: "", 账户1: "", 备注: "" };

export function isDuplicateRow(row: { issues: { code: string }[] }): boolean {
  return row.issues.some((issue) => issue.code === "duplicate_existing" || issue.code === "duplicate_pending");
}

export function isDuplicatePendingRow(row: PreviewRow): boolean {
  return row.issues.some((issue) => issue.code === "duplicate_pending");
}

export function sourceLabel(source: SourcePlatform): string {
  return source === "alipay" ? "支付宝" : "微信";
}

export function buildDuplicateConfirmGroups(rows: PreviewRow[]): DuplicateConfirmGroup[] {
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

export function withoutDuplicateDecision(override: RowOverride): RowOverride | null {
  const rest: RowOverride = { ...override };
  delete rest.duplicateExisting;
  delete rest.duplicateKey;
  const hasFields = Boolean(rest.fields && Object.keys(rest.fields).length > 0);
  return hasFields || rest.include !== undefined ? rest : null;
}
