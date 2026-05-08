<!-- 此文件由 scripts/sync-ai-rules.mjs 自动生成自 AGENTS.md，请勿直接编辑。 -->

# Copilot Instructions

## 通用
- 使用简体中文回复与代码注释。
- 包管理器使用 `pnpm`，不要建议 `npm` / `yarn`。

## 技术栈
- Astro 6.x（继承 `astro/tsconfigs/strict`），Node ≥ 22.12。
- 默认 SSG，无 UI 框架（React/Vue/Svelte）；如需引入，先说明取舍再写代码。
- 文件路由：页面放 `src/pages/`，组件放 `src/components/`，布局放 `src/layouts/`。
- 静态资源：需构建优化的放 `src/assets/`；原样输出的放 `public/`。

## 代码风格
- 缩进使用 **tab**（详见 `.editorconfig`）。
- HTML 属性用双引号，TS / import 用单引号。
- TypeScript 显式类型，避免 `any`。
- 样式写在 `.astro` 组件内 `<style>`，利用默认作用域，避免全局污染。

## 输出约束
- 优先修改已有文件，避免新建。
- 引入新依赖前必须说明用途与替代方案。
- 不写解释 WHAT 的注释；仅在 WHY 不明显时加一行。
- 不为不会发生的场景添加错误处理或兼容代码。

## 提交消息规则
- 始终使用简体中文。
- 遵循 Conventional Commits：第一行 `<type>: <简短描述>`。
- type 保留英文：feat / fix / docs / refactor / chore / test / perf / style / build / ci。
- 描述用中文，标题行不超过 50 字符。
- 必要时空一行后写正文，每行不超过 72 字符。
- 只描述"做了什么 / 为什么"，不要罗列文件名。
