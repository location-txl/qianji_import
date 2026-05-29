# 钱迹账簿整理台

将支付宝 / 微信支付账单导出文件转换为[钱迹](https://www.qianjiapp.com/)导入模板格式的本地优先 Web 应用。

**所有账单解析均在浏览器端完成，数据不会上传到任何远程服务器。**

## 功能

- **双平台支持** — 解析支付宝（GB18030 CSV）和微信支付（XLSX）账单
- **智能分类** — 基于关键词、来源平台、时间段的有序规则自动匹配钱迹分类
- **关键字排除** — 配置排除规则，过滤不需要导入的交易
- **支付方式映射** — 自动将"零钱""余额宝"等映射到对应账户
- **可编辑预览** — 导出前在表格内直接修改分类、金额、备注等字段
- **防御性导出** — 退款、转账、缺少映射等异常交易自动标记待确认，需用户显式操作
- **配置持久化** — 映射规则和排除规则保存在服务端，刷新不丢失

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

打开 http://localhost:3000 即可使用。

### 构建与部署

```bash
pnpm build    # 生产构建
pnpm start    # 启动生产服务器
```

## 使用流程

1. **上传账单** — 在页面上选择支付宝或微信支付的账单导出文件
2. **配置规则** — 在配置面板中设置分类规则、排除规则、支付方式映射
3. **预览调整** — 在预览表格中检查自动分类结果，手动修正问题行
4. **导出下载** — 确认无误后导出为钱迹可直接导入的 UTF-8 BOM CSV 文件

## 开发

```bash
pnpm dev                    # 开发服务器 (Turbopack)
pnpm lint                   # ESLint 检查
pnpm test                   # 运行全部测试
pnpm test -- src/features/import/parsers.test.ts  # 运行单个测试文件
```

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui + Tailwind CSS v4 |
| 语言 | TypeScript 5 |
| 测试 | Vitest |
| 包管理 | pnpm |

## 项目结构

```
src/
├── app/                        # Next.js 路由
│   ├── api/config/route.ts     # 配置持久化 API（唯一的服务端代码）
│   ├── layout.tsx
│   └── page.tsx
├── components/ui/              # shadcn/ui 组件
└── features/import/            # 核心业务逻辑
    ├── types.ts                # 类型定义
    ├── config.ts               # 配置校验与默认值
    ├── config-store.ts         # 配置读写
    ├── parsers.ts              # 支付宝/微信账单解析
    ├── transform.ts            # 转换管线（过滤→分类→映射→检测）
    ├── export.ts               # CSV 导出
    ├── ImportWorkbench.tsx     # 主页面组件
    ├── ConfigPanel.tsx         # 配置面板
    ├── PreviewTable.tsx        # 可编辑预览表格
    └── *.test.ts               # 对应模块的测试
```

## License

Private
