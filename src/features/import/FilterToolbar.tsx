"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search } from "lucide-react";
import type { ViewFilter } from "./utils";

interface FilterToolbarProps {
  filter: ViewFilter;
  search: string;
  uncategorizedOnly: boolean;
  totalCount: number;
  readyCount: number;
  pendingCount: number;
  duplicateCount: number;
  uncategorizedReadyCount: number;
  onFilterChange: (filter: ViewFilter) => void;
  onSearchChange: (search: string) => void;
  onUncategorizedOnlyChange: (checked: boolean) => void;
}

export function FilterToolbar({
  filter,
  search,
  uncategorizedOnly,
  totalCount,
  readyCount,
  pendingCount,
  duplicateCount,
  uncategorizedReadyCount,
  onFilterChange,
  onSearchChange,
  onUncategorizedOnlyChange,
}: FilterToolbarProps) {
  return (
    <div className="mb-3 flex justify-between gap-4">
      <ToggleGroup
        value={[filter]}
        onValueChange={(value) => { if (value.length > 0) { onFilterChange(value[0] as ViewFilter); } }}
        variant="default"
        spacing={0}
        className="rounded-sm bg-[#f3ede3] p-[3px]"
      >
        <ToggleGroupItem value="all" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
          全部 {totalCount}
        </ToggleGroupItem>
        <ToggleGroupItem value="ready" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
          可导出 {readyCount}
        </ToggleGroupItem>
        <ToggleGroupItem value="pending" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
          待处理 {pendingCount}
        </ToggleGroupItem>
        <ToggleGroupItem value="duplicate" className="h-[34px] rounded-sm px-4 data-pressed:bg-primary data-pressed:text-primary-foreground">
          重复 {duplicateCount}
        </ToggleGroupItem>
      </ToggleGroup>
      {filter === "ready" && (
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <Checkbox
            checked={uncategorizedOnly}
            onCheckedChange={(checked) => onUncategorizedOnlyChange(checked === true)}
          />
          <span>仅未分类 ({uncategorizedReadyCount})</span>
        </label>
      )}
      <InputGroup className="max-w-[270px]">
        <InputGroupInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索商户、商品或账户"
        />
        <InputGroupAddon align="inline-end">
          <Search data-icon="inline-start" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
