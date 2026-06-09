"use client";

import { useEffect, useState } from "react";
import type { AISettings } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Sparkles } from "lucide-react";

export function AiSettingsTab() {
  const [aiForm, setAiForm] = useState<AISettings>({
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    enabled: false,
  });
  const [aiDirty, setAiDirty] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/ai-settings")
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) throw new Error(payload.message ?? "读取 AI 设置失败");
        return payload as AISettings;
      })
      .then((settings) => {
        if (active) setAiForm(settings);
      })
      .catch((err: Error) => {
        if (active) setAiMessage(err.message);
      });
    return () => { active = false; };
  }, []);

  function updateAiForm(patch: Partial<AISettings>) {
    setAiForm((current) => ({ ...current, ...patch }));
    setAiDirty(true);
    setAiMessage("");
  }

  async function saveAiSettings() {
    setAiSaving(true);
    setAiMessage("");
    try {
      const response = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "保存失败");
      setAiForm(payload as AISettings);
      setAiDirty(false);
      setAiMessage("AI 设置已保存。");
    } catch (err) {
      setAiMessage((err as Error).message);
    } finally {
      setAiSaving(false);
    }
  }

  async function testAiConnection() {
    setAiTesting(true);
    setAiMessage("");
    try {
      const response = await fetch("/api/ai-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: [{
            id: "test",
            source: "alipay",
            sourceRow: 1,
            occurredAt: "2024-01-01 12:00:00",
            sourceCategory: "餐饮美食",
            transactionKind: "即时到账交易",
            direction: "支出",
            amount: 25,
            paymentMethod: "",
            basePaymentMethod: "",
            status: "交易成功",
            counterparty: "测试商户",
            item: "测试商品",
            tradeNo: "",
            merchantNo: "",
            originalNote: "",
          }],
          config: { categoryRules: [], sourceCategoryMappings: {} },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "连接失败");
      setAiMessage(`连接成功！模型 ${aiForm.model} 正常响应。`);
    } catch (err) {
      setAiMessage(`测试失败：${(err as Error).message}`);
    } finally {
      setAiTesting(false);
    }
  }

  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="size-4 text-accent" />
        <h3 className="text-sm font-bold">AI 智能分类</h3>
        {aiForm.enabled && (
          <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">已启用</Badge>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
        接入 OpenAI 兼容接口，AI 可自动识别待处理交易的分类并提取关键词生成规则。
      </p>
      <div className="flex flex-col gap-2">
        <Field orientation="horizontal" className="items-center gap-2">
          <FieldLabel htmlFor="ai-enabled" className="min-w-[80px] text-xs">启用 AI</FieldLabel>
          <input
            id="ai-enabled"
            type="checkbox"
            checked={aiForm.enabled}
            onChange={(event) => updateAiForm({ enabled: event.target.checked })}
            className="size-4"
          />
        </Field>
        <Field orientation="horizontal" className="items-center gap-2">
          <FieldLabel htmlFor="ai-base-url" className="min-w-[80px] text-xs">API 地址</FieldLabel>
          <Input
            id="ai-base-url"
            value={aiForm.baseUrl}
            onChange={(event) => updateAiForm({ baseUrl: event.target.value })}
            placeholder="https://api.openai.com/v1"
            className="flex-1 font-mono text-xs"
          />
        </Field>
        <Field orientation="horizontal" className="items-center gap-2">
          <FieldLabel htmlFor="ai-api-key" className="min-w-[80px] text-xs">API Key</FieldLabel>
          <Input
            id="ai-api-key"
            type="password"
            value={aiForm.apiKey}
            onChange={(event) => updateAiForm({ apiKey: event.target.value })}
            placeholder="sk-..."
            className="flex-1 font-mono text-xs"
          />
        </Field>
        <Field orientation="horizontal" className="items-center gap-2">
          <FieldLabel htmlFor="ai-model" className="min-w-[80px] text-xs">模型</FieldLabel>
          <Input
            id="ai-model"
            value={aiForm.model}
            onChange={(event) => updateAiForm({ model: event.target.value })}
            placeholder="gpt-4o-mini"
            className="flex-1 font-mono text-xs"
          />
        </Field>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={testAiConnection}
            disabled={aiTesting || !aiForm.apiKey}
          >
            {aiTesting ? "测试中..." : "测试连接"}
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={saveAiSettings}
            disabled={!aiDirty || aiSaving}
          >
            {aiSaving ? "保存中" : aiDirty ? "保存 AI 设置" : "已保存"}
          </Button>
          {aiMessage && (
            <span className={cn(
              "text-xs",
              aiMessage.includes("成功") || aiMessage.includes("已保存") ? "text-[#44816f]" : "text-destructive",
            )}>
              {aiMessage}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
