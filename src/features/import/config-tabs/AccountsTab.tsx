"use client";

import { useMemo, useState } from "react";
import { COMMON_ACCOUNT_OPTIONS } from "../config";
import type { AppConfig, NormalizedTransaction } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { X } from "lucide-react";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

interface AccountsTabProps {
  config: AppConfig;
  transactions: NormalizedTransaction[];
  onChange: (config: AppConfig) => void;
}

export function AccountsTab({ config, transactions, onChange }: AccountsTabProps) {
  const [accountDraft, setAccountDraft] = useState("");

  const paymentMethods = useMemo(
    () =>
      unique([
        ...Object.keys(config.paymentMethodMappings),
        ...transactions.map((t) => t.basePaymentMethod),
      ]),
    [config.paymentMethodMappings, transactions],
  );

  function changeMapping(key: string, value: string) {
    onChange({
      ...config,
      paymentMethodMappings: { ...config.paymentMethodMappings, [key]: value },
    });
  }

  function addAccount() {
    const account = accountDraft.trim();
    if (!account) return;
    onChange({ ...config, accounts: unique([...config.accounts, account]) });
    setAccountDraft("");
  }

  function removeAccount(account: string) {
    onChange({ ...config, accounts: config.accounts.filter((a) => a !== account) });
  }

  return (
    <>
      <h3 className="mb-3 text-sm font-bold">钱迹账户</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {config.accounts.map((account) => (
          <Badge variant="secondary" key={account} className="gap-1 rounded-full px-2.5 py-1 text-sm">
            {account}
            {!COMMON_ACCOUNT_OPTIONS.includes(account) && (
              <button
                type="button"
                onClick={() => removeAccount(account)}
                aria-label={`移除账户 ${account}`}
                className="ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={accountDraft}
          onChange={(event) => setAccountDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addAccount()}
          placeholder="新增账户，如 招商信用卡"
          className="min-w-0 flex-1"
        />
        <Button variant="outline" type="button" onClick={addAccount}>
          添加
        </Button>
      </div>

      {/* 支付方式映射 */}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-bold">支付方式 → 钱迹账户</h3>
        {paymentMethods.length === 0 ? (
          <p className="text-xs text-muted-foreground leading-relaxed">上传账单后，支付方式会自动出现在这里。</p>
        ) : (
          <FieldGroup className="gap-2">
            {paymentMethods.map((method, index) => (
              <Field key={method} orientation="horizontal" className="items-center gap-2">
                <FieldLabel htmlFor={`payment-mapping-${index}`} className="min-w-[100px] text-xs text-muted-foreground">
                  {method}
                </FieldLabel>
                <Input
                  id={`payment-mapping-${index}`}
                  list="account-options"
                  value={config.paymentMethodMappings[method] ?? ""}
                  onChange={(event) => changeMapping(method, event.target.value)}
                  placeholder="选择或输入账户"
                  className="min-w-[130px] flex-1"
                />
              </Field>
            ))}
          </FieldGroup>
        )}
      </div>
    </>
  );
}
