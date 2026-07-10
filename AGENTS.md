# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — 开发服务器 (localhost:3000, Turbopack)
- `pnpm build` — 生产构建
- `pnpm lint` — ESLint (flat config, next/core-web-vitals + next/typescript)
- `pnpm test` — Vitest 单次运行（无 watch 模式）
- `pnpm test -- src/features/import/parsers.test.ts` — 运行单个测试文件
- `pnpm add -D <pkg>` — 安装依赖（使用 pnpm）
- `pnpm dlx shadcn@latest add <component>` — 添加 shadcn/ui 组件

## Architecture

**钱迹账簿整理台** — 本地优先的 Web 应用，将支付宝/微信支付账单导出文件转换为"钱迹"导入模板格式。所有账单解析在浏览器端完成，不上传到任何远程服务器。

### Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4 + shadcn/ui (base-nova) + Vitest + pnpm

### Core Data Flow

```
用户上传文件 → 浏览器端解析 (parsers.ts) → NormalizedTransaction[]
    ↓
配置 + 规则 → transform.ts → PreviewRow[] → PreviewTable 编辑
    ↓
AI 分类 (可选) → /api/ai-categorize → AICategorySuggestion[] → 自动采纳+学习规则
    ↓
export.ts → Qianji CSV 下载
```

1. **解析层** (`parsers.ts`): `parseAlipayBuffer()` 处理 GB18030 编码 CSV，`parseWechatBuffer()` 处理 XLSX，均输出 `NormalizedTransaction[]`
2. **转换层** (`transform.ts`): `buildPreviewRows()` 应用日期过滤 → 排除规则 → 分类规则（有序，首匹配） → 支付方式映射 → 问题检测
3. **导出层** (`export.ts`): `createQianjiCsv()` 生成 UTF-8 BOM CSV，有问题的交易默认排除
4. **配置持久化** (`config-store.ts` + `api/config/route.ts`): 唯一的服务端代码，原子写入 `data/config.json`（gitignored）
5. **AI 设置持久化** (`ai-store.ts` + `api/ai-settings/route.ts`): 读写 `data/ai-settings.json`，API Key 仅存服务端，GET 接口脱敏返回
6. **AI 分类** (`api/ai-categorize/route.ts`): 接收待分类交易 + 已有规则，调用 OpenAI 兼容接口，返回 `AICategorySuggestion[]`（含 category、keywords、reasoning）

### Key Design Decisions

- **无外部状态管理**: 所有状态在 `ImportWorkbench` 组件内用 `useState` + `useMemo` 管理
- **Feature-based 结构**: 业务逻辑集中在 `src/features/import/`，类型/解析/转换/组件/测试同目录
- **防御性导出**: 退款、转账、缺少映射、无效状态的交易自动标记为 pending，需用户显式确认才能导出
- **规则优先级**: `categoryRules`（关键词+来源+时间段，有序首匹配）优先于 `sourceCategoryMappings`
- **AI 学习闭环**: 采纳 AI 建议时自动提取 keywords 生成 `CategoryRule`（`aiLearned: true`），下次无需 AI 直接匹配；同 source+keyword 去重不重复添加
- **AI Key 安全**: `apiKey` 仅存服务端 `data/ai-settings.json`，GET 接口脱敏返回（只显示后 4 位），永不传到前端
- **OpenAI 协议兼容**: 标准 `/v1/chat/completions`，用户可填任何兼容端点（OpenAI / DeepSeek / Ollama 等）

### Key Files

- `src/features/import/types.ts` — 所有 TypeScript 类型定义
- `src/features/import/ImportWorkbench.tsx` — 主页面组件（~425 行）
- `src/features/import/ConfigPanel.tsx` — 配置面板壳（Tabs 容器 + datalists + footer）
- `src/features/import/config-tabs/AccountsTab.tsx` — 账户 tab（钱迹账户 + 付款方式映射）
- `src/features/import/config-tabs/CategoryTab.tsx` — 分类 tab（分类总表 + 来源分类映射）
- `src/features/import/config-tabs/CategoryRulesTab.tsx` — 分类规则 tab
- `src/features/import/config-tabs/ExcludeRulesTab.tsx` — 排除规则 tab
- `src/features/import/config-tabs/AiSettingsTab.tsx` — AI 设置 tab
- `src/features/import/PreviewTable.tsx` — 可编辑预览表格
- `src/features/import/ai-store.ts` — AI 设置持久化（读写 data/ai-settings.json）
- `src/app/api/ai-settings/route.ts` — AI 设置 API（GET/PUT，脱敏返回）
- `src/app/api/ai-categorize/route.ts` — AI 分类 API（POST，调 OpenAI 兼容接口）
- `data/config.json` — 运行时配置（账户、映射规则、排除规则）
- `data/ai-settings.json` — AI 连接配置（baseUrl、apiKey、model、enabled）

### Testing

Vitest 测试文件与源码同目录（`*.test.ts`）。测试覆盖解析、转换、配置存储、CSV 导出四个模块。运行 `pnpm test` 执行全部，指定文件路径运行单个。
