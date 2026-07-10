"use client";

import { COMMON_ACCOUNT_OPTIONS } from "./config";
import type { AppConfig, NormalizedTransaction } from "./types";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AccountsTab } from "./config-tabs/AccountsTab";
import { CategoryTab } from "./config-tabs/CategoryTab";
import { CategoryRulesTab } from "./config-tabs/CategoryRulesTab";
import { ExcludeRulesTab } from "./config-tabs/ExcludeRulesTab";
import { AiSettingsTab } from "./config-tabs/AiSettingsTab";

interface ConfigPanelProps {
  config: AppConfig;
  transactions: NormalizedTransaction[];
  dirty: boolean;
  saving: boolean;
  message: string;
  onChange: (config: AppConfig) => void;
  onSave: () => void;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function ConfigPanel({
  config,
  transactions,
  dirty,
  saving,
  message,
  onChange,
  onSave,
}: ConfigPanelProps) {
  const accountOptions = unique([...COMMON_ACCOUNT_OPTIONS, ...config.accounts]);
  const masterCategoryNames = config.masterCategories.map((c) => c.category);

  return (
    <>
      <DialogHeader>
        <div>
          <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-accent">02 / 映射规则</p>
          <DialogTitle className="font-title text-2xl">账户与分类</DialogTitle>
        </div>
        <DialogDescription className="font-mono text-xs">
          配置仅写入本机 <code>data/config.json</code>，不会保存上传账单或预览明细。
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="accounts" className="flex flex-1 flex-col gap-0 overflow-hidden">
        {message && (
          <div className="mx-1 mt-1 rounded-sm bg-primary/5 p-2.5 text-sm text-primary">{message}</div>
        )}
        <TabsList variant="line" className="mx-1 shrink-0">
          <TabsTrigger value="accounts">账户</TabsTrigger>
          <TabsTrigger value="category">分类</TabsTrigger>
          <TabsTrigger value="rules">分类规则</TabsTrigger>
          <TabsTrigger value="exclude">排除规则</TabsTrigger>
          <TabsTrigger value="ai">AI 设置</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="flex-1 overflow-y-auto px-1 pb-4 pt-3">
          <AccountsTab config={config} transactions={transactions} onChange={onChange} />
        </TabsContent>

        <TabsContent value="category" className="flex-1 overflow-y-auto px-1 pb-4 pt-3">
          <CategoryTab config={config} transactions={transactions} onChange={onChange} />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 overflow-y-auto px-1 pb-4 pt-3">
          <CategoryRulesTab config={config} onChange={onChange} />
        </TabsContent>

        <TabsContent value="exclude" className="flex-1 overflow-y-auto px-1 pb-4 pt-3">
          <ExcludeRulesTab config={config} onChange={onChange} />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-y-auto px-1 pb-4 pt-3">
          <AiSettingsTab />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <div className="flex items-center gap-3">
          {message && <span className="text-sm text-primary">{message}</span>}
          <Button disabled={!dirty || saving} onClick={onSave}>
            {saving ? "保存中" : dirty ? "保存配置" : "已保存"}
          </Button>
        </div>
      </DialogFooter>

      <datalist id="account-options">
        {accountOptions.map((account) => <option key={account} value={account} />)}
      </datalist>
      <datalist id="master-category-options">
        {masterCategoryNames.map((cat) => <option key={cat} value={cat} />)}
      </datalist>
      <datalist id="master-subcategory-options">
        {config.masterCategories.flatMap((mc) => mc.subCategories).filter((v, i, a) => a.indexOf(v) === i).sort((l, r) => l.localeCompare(r, "zh-CN")).map((sub) => <option key={sub} value={sub} />)}
      </datalist>
    </>
  );
}
