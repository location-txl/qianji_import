import { useState, type ChangeEvent } from "react";
import { parseAlipayBuffer, parseQianjiExistingCsvBuffer, parseWechatBuffer } from "./parsers";
import type { ExistingQianjiRecord, NormalizedTransaction, RowOverride, SourcePlatform } from "./types";
import { withoutDuplicateDecision, type LoadedFile } from "./utils";

export function useFileImport(
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, RowOverride>>>,
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [existingRecords, setExistingRecords] = useState<ExistingQianjiRecord[]>([]);
  const [loadedFiles, setLoadedFiles] = useState<Partial<Record<SourcePlatform, LoadedFile>>>({});
  const [loadedExistingFile, setLoadedExistingFile] = useState<LoadedFile | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function loadFile(source: SourcePlatform, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportMessage("");
    (async () => {
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
    })();
  }

  function loadExistingQianjiFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportMessage("");
    (async () => {
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
        setSelectedIds(new Set());
        setLoadedExistingFile({ name: file.name, count: parsed.length });
        setImportMessage(`钱迹已有账单已载入，共 ${parsed.length} 条可参与去重。`);
      } catch (error) {
        setImportMessage((error as Error).message);
      } finally {
        event.target.value = "";
      }
    })();
  }

  return {
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
  };
}
