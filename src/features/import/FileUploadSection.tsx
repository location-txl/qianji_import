"use client";

import type { ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LoadedFile } from "./utils";
import type { SourcePlatform } from "./types";

interface FileUploadSectionProps {
  loadedExistingFile: LoadedFile | null;
  loadedFiles: Partial<Record<SourcePlatform, LoadedFile>>;
  importMessage: string;
  hasTransactions: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onLoadFile: (source: SourcePlatform, event: ChangeEvent<HTMLInputElement>) => void;
  onLoadExisting: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function FileUploadSection({
  loadedExistingFile,
  loadedFiles,
  importMessage,
  hasTransactions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onLoadFile,
  onLoadExisting,
}: FileUploadSectionProps) {
  return (
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
            <input name="existing-qianji-csv" type="file" accept=".csv,text/csv" aria-label="选择钱迹已有 CSV" onChange={onLoadExisting} className="mt-3 block max-w-full text-xs text-muted-foreground" />
          </label>
          <label className="block cursor-pointer rounded-sm border border-dashed border-[#c5b9a7] bg-[#fcf8f0] p-4 transition-colors hover:border-accent hover:bg-[#fff8ee]">
            <span className="block text-xs font-bold text-accent">支付宝 CSV</span>
            <strong className="my-1.5 block truncate">{loadedFiles.alipay?.name ?? "选择交易明细"}</strong>
            <small className="block text-muted-foreground leading-relaxed">
              {loadedFiles.alipay ? `${loadedFiles.alipay.count} 条已载入` : "支持含说明行的官方导出文件"}
            </small>
            <input name="alipay-csv" type="file" accept=".csv,text/csv" aria-label="选择支付宝 CSV" onChange={(event) => onLoadFile("alipay", event)} className="mt-3 block max-w-full text-xs text-muted-foreground" />
          </label>
          <label className="block cursor-pointer rounded-sm border border-dashed border-[#c5b9a7] bg-[#fcf8f0] p-4 transition-colors hover:border-accent hover:bg-[#fff8ee]">
            <span className="block text-xs font-bold text-accent">微信 XLSX</span>
            <strong className="my-1.5 block truncate">{loadedFiles.wechat?.name ?? "选择支付账单"}</strong>
            <small className="block text-muted-foreground leading-relaxed">
              {loadedFiles.wechat ? `${loadedFiles.wechat.count} 条已载入` : "支持官方 Excel 流水文件"}
            </small>
            <input name="wechat-xlsx" type="file" accept=".xlsx" aria-label="选择微信 XLSX" onChange={(event) => onLoadFile("wechat", event)} className="mt-3 block max-w-full text-xs text-muted-foreground" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4">
          {hasTransactions && (
            <div className="flex items-center gap-1.5">
              <label className="text-sm">日期范围</label>
              <Input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} title="起始日期" className="w-[140px]" />
              <span>—</span>
              <Input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} title="截止日期" className="w-[140px]" />
            </div>
          )}
          {importMessage && (
            <div className="rounded-sm bg-primary/5 p-2.5 text-sm text-primary">{importMessage}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
