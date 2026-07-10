# AI 智能分类 + 关键字学习 实施任务

## 1. 类型定义与 AI 设置基础设施
- [x] 1.1 types.ts 新增 AISettings、AICategorySuggestion 类型
- [x] 1.2 新建 ai-store.ts（读写 data/ai-settings.json）
- [x] 1.3 新建 /api/ai-settings/route.ts（GET/PUT，脱敏返回）
- [x] 1.4 ai-store 单元测试

## 2. 服务端 AI 分类 API 路由
- [x] 2.1 新建 /api/ai-categorize/route.ts（POST，调 OpenAI 兼容接口）
- [x] 2.2 Prompt 设计 + JSON 解析容错
- [x] 2.3 route 单元测试

## 3. 前端 AI 分析交互
- [x] 3.1 ImportWorkbench 新增 AI 状态 + 调用逻辑
- [x] 3.2 批量操作栏增加「AI 分析」按钮
- [x] 3.3 PreviewTable 展示 AI 建议（badge + tooltip + 采纳/忽略）
- [x] 3.4 批量「采纳全部 AI 建议」按钮

## 4. 关键字→规则自动生成（学习闭环）
- [x] 4.1 采纳时自动生成 CategoryRule 并写入 config
- [x] 4.2 去重逻辑（同 keyword+source 不重复添加）
- [x] 4.3 AI 生成规则标记（aiLearned 字段）

## 5. 配置面板 AI 设置区
- [x] 5.1 ConfigPanel 新增 AI 设置区域
- [x] 5.2 测试连接按钮

## 6. 测试
- [x] 6.1 全量测试通过
